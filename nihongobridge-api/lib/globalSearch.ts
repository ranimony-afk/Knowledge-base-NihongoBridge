import {
  dictionaryEntries,
  grammarPatterns,
  kanjiEntries,
  sentences,
} from "@nihongobridge/knowledge";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { searchGrammar } from "@/lib/grammar";
import { searchKanji } from "@/lib/kanji";
import {
  multiIndexSearch,
  type GlobalSearchType,
} from "@/lib/search-index";
import { searchDictionaryWithPostgres } from "@/lib/search";
import {
  dictionaryDto,
  grammarDetailDto,
  kanjiDto,
  sentenceDto,
} from "@/lib/serializers";
import type {
  DictionaryEntryDto,
  GrammarDetailDto,
  KanjiEntryDto,
  SentenceDto,
} from "@/types/api";

export interface GlobalSearchResult {
  words: DictionaryEntryDto[];
  kanji: KanjiEntryDto[];
  grammar: GrammarDetailDto[];
  sentences: SentenceDto[];
  totals: Record<GlobalSearchType, number>;
  engine: "meilisearch" | "postgresql";
}

export async function globalSearch(parameters: {
  q: string;
  types: GlobalSearchType[];
  level?: "N5" | "N4" | "N3" | "N2" | "N1" | undefined;
  limit: number;
}): Promise<GlobalSearchResult> {
  if (process.env.MEILISEARCH_URL) {
    try {
      const result = await multiIndexSearch(parameters);
      return await hydrateMeiliResult(result.ids, result.totals);
    } catch (error) {
      console.warn(
        "Meilisearch multi-index query failed; using PostgreSQL fallback:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  return postgresGlobalSearch(parameters);
}

async function hydrateMeiliResult(
  ids: Record<GlobalSearchType, string[]>,
  totals: Record<GlobalSearchType, number>,
): Promise<GlobalSearchResult> {
  const db = getDatabase();
  const [wordRows, kanjiRows, grammarRows, sentenceRows] = await Promise.all([
    ids.word.length
      ? db
          .select()
          .from(dictionaryEntries)
          .where(and(inArray(dictionaryEntries.id, ids.word), eq(dictionaryEntries.isActive, true)))
      : [],
    ids.kanji.length
      ? db.select().from(kanjiEntries).where(inArray(kanjiEntries.id, ids.kanji))
      : [],
    ids.grammar.length
      ? db.select().from(grammarPatterns).where(inArray(grammarPatterns.id, ids.grammar))
      : [],
    ids.sentence.length
      ? db.select().from(sentences).where(inArray(sentences.id, ids.sentence))
      : [],
  ]);
  sortByIds(wordRows, ids.word);
  sortByIds(kanjiRows, ids.kanji);
  sortByIds(grammarRows, ids.grammar);
  sortByIds(sentenceRows, ids.sentence);
  return {
    words: wordRows.map(dictionaryDto),
    kanji: kanjiRows.map(kanjiDto),
    grammar: grammarRows.map(grammarDetailDto),
    sentences: sentenceRows.map(sentenceDto),
    totals,
    engine: "meilisearch",
  };
}

async function postgresGlobalSearch(parameters: {
  q: string;
  types: GlobalSearchType[];
  level?: "N5" | "N4" | "N3" | "N2" | "N1" | undefined;
  limit: number;
}): Promise<GlobalSearchResult> {
  const selected = new Set(parameters.types);
  const [wordResult, kanjiResult, grammarResult, sentenceResult] = await Promise.all([
    selected.has("word")
      ? searchDictionaryWithPostgres({
          q: parameters.q,
          level: parameters.level,
          page: 1,
          limit: parameters.limit,
        })
      : emptyResult<DictionaryEntryDto>(),
    selected.has("kanji")
      ? searchKanji({
          q: parameters.q,
          level: parameters.level,
          page: 1,
          limit: parameters.limit,
        })
      : emptyResult<KanjiEntryDto>(),
    selected.has("grammar")
      ? searchGrammar({
          q: parameters.q,
          level: parameters.level,
          page: 1,
          limit: parameters.limit,
        })
      : emptyResult<GrammarDetailDto>(),
    selected.has("sentence")
      ? searchSentences(parameters.q, parameters.level, parameters.limit)
      : emptyResult<SentenceDto>(),
  ]);
  return {
    words: wordResult.items,
    kanji: kanjiResult.items,
    grammar: grammarResult.items,
    sentences: sentenceResult.items,
    totals: {
      word: wordResult.total,
      kanji: kanjiResult.total,
      grammar: grammarResult.total,
      sentence: sentenceResult.total,
    },
    engine: "postgresql",
  };
}

async function searchSentences(
  query: string,
  level: "N5" | "N4" | "N3" | "N2" | "N1" | undefined,
  limit: number,
): Promise<{ items: SentenceDto[]; total: number }> {
  const vector = sql`(
    setweight(to_tsvector('simple', coalesce(${sentences.japanese}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${sentences.translations}::text, '')), 'B')
  )`;
  const filters = [
    sql`(
      ${vector} @@ plainto_tsquery('simple', ${query})
      OR ${vector} @@ plainto_tsquery('english', ${query})
      OR strpos(${sentences.japanese}, ${query}) > 0
      OR strpos(lower(${sentences.translations}::text), lower(${query})) > 0
    )`,
  ];
  if (level) filters.push(eq(sentences.jlptLevel, level));
  const where = and(...filters);
  const db = getDatabase();
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(sentences)
      .where(where)
      .orderBy(asc(sentences.japanese))
      .limit(limit),
    db.select({ value: count() }).from(sentences).where(where),
  ]);
  return { items: rows.map(sentenceDto), total: totals[0]?.value ?? 0 };
}

function sortByIds<T extends { id: string }>(rows: T[], ids: string[]): void {
  const order = new Map(ids.map((id, index) => [id, index]));
  rows.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

function emptyResult<T>(): { items: T[]; total: number } {
  return { items: [], total: 0 };
}
