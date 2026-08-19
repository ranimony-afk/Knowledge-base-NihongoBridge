import {
  dictionaryEntries,
  dictionaryGrammarLinks,
  dictionaryKanjiLinks,
  grammarPatterns,
  kanjiEntries,
  sentenceVocabularyLinks,
  sentences,
} from "@nihongobridge/knowledge";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { dictionaryDto, grammarDto, kanjiDto, sentenceDto } from "@/lib/serializers";
import type {
  DictionaryAutocompleteDto,
  DictionaryDetailDto,
  DictionaryEntryDto,
} from "@/types/api";

export async function getDictionaryDetail(id: string): Promise<DictionaryDetailDto | null> {
  const db = getDatabase();
  const [entry] = await db
    .select()
    .from(dictionaryEntries)
    .where(and(eq(dictionaryEntries.id, id), eq(dictionaryEntries.isActive, true)))
    .limit(1);
  if (!entry) return null;

  const [sentenceLinks, kanjiLinks, grammarLinks] = await Promise.all([
    db
      .select({ id: sentenceVocabularyLinks.sentenceId })
      .from(sentenceVocabularyLinks)
      .where(eq(sentenceVocabularyLinks.dictionaryEntryId, id))
      .limit(3),
    db
      .select({ id: dictionaryKanjiLinks.kanjiEntryId })
      .from(dictionaryKanjiLinks)
      .where(eq(dictionaryKanjiLinks.dictionaryEntryId, id))
      .orderBy(asc(dictionaryKanjiLinks.exampleRank)),
    db
      .select({ id: dictionaryGrammarLinks.grammarPatternId })
      .from(dictionaryGrammarLinks)
      .where(eq(dictionaryGrammarLinks.dictionaryEntryId, id)),
  ]);

  const sentenceIds = sentenceLinks.length
    ? sentenceLinks.map((link) => link.id)
    : entry.exampleSentenceIds.slice(0, 3);
  const grammarIds = grammarLinks.length
    ? grammarLinks.map((link) => link.id)
    : entry.grammarIds;

  const [sentenceRows, kanjiRows, grammarRows] = await Promise.all([
    sentenceIds.length
      ? db.select().from(sentences).where(inArray(sentences.id, sentenceIds)).limit(3)
      : [],
    kanjiLinks.length
      ? db
          .select()
          .from(kanjiEntries)
          .where(inArray(kanjiEntries.id, kanjiLinks.map((link) => link.id)))
      : entry.kanjiIds.length
        ? db
            .select()
            .from(kanjiEntries)
            .where(inArray(kanjiEntries.character, entry.kanjiIds))
        : [],
    grammarIds.length
      ? db.select().from(grammarPatterns).where(inArray(grammarPatterns.id, grammarIds))
      : [],
  ]);

  const sentenceOrder = new Map(sentenceIds.map((value, index) => [value, index]));
  sentenceRows.sort(
    (left, right) => (sentenceOrder.get(left.id) ?? 0) - (sentenceOrder.get(right.id) ?? 0),
  );
  const kanjiOrder = new Map(
    (kanjiLinks.length ? kanjiLinks.map((link) => link.id) : entry.kanjiIds).map(
      (value, index) => [value, index],
    ),
  );
  kanjiRows.sort(
    (left, right) =>
      (kanjiOrder.get(left.id) ?? kanjiOrder.get(left.character) ?? 0) -
      (kanjiOrder.get(right.id) ?? kanjiOrder.get(right.character) ?? 0),
  );

  return {
    ...dictionaryDto(entry),
    example_sentences: sentenceRows.map(sentenceDto),
    related_kanji: kanjiRows.map(kanjiDto),
    grammar_patterns: grammarRows.map(grammarDto),
  };
}

export async function autocompleteDictionary(
  query: string,
  limit: number,
): Promise<DictionaryAutocompleteDto[]> {
  const escapedPrefix = `${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await getDatabase()
    .select()
    .from(dictionaryEntries)
    .where(
      and(
        eq(dictionaryEntries.isActive, true),
        sql`(
          ${dictionaryEntries.word} LIKE ${escapedPrefix} ESCAPE E'\\\\'
          OR coalesce(${dictionaryEntries.kana}, '') LIKE ${escapedPrefix} ESCAPE E'\\\\'
        )`,
      ),
    )
    .orderBy(
      sql`CASE
        WHEN ${dictionaryEntries.word} = ${query} THEN 0
        WHEN ${dictionaryEntries.kana} = ${query} THEN 1
        WHEN ${dictionaryEntries.word} LIKE ${escapedPrefix} ESCAPE E'\\\\' THEN 2
        ELSE 3
      END`,
      asc(dictionaryEntries.frequencyRank),
      asc(dictionaryEntries.word),
    )
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    word: row.word,
    kana: row.kana,
    meaning:
      row.meanings.find((meaning) => meaning.lang === "en" || meaning.lang === "eng")?.value ??
      row.meanings[0]?.value ??
      null,
    jlpt_level: row.jlptLevel,
  }));
}

export async function randomDictionaryEntries(
  level: "N5" | "N4" | "N3" | "N2" | "N1" | undefined,
  limit: number,
): Promise<{ items: DictionaryEntryDto[]; total: number }> {
  const db = getDatabase();
  const filter = level
    ? and(eq(dictionaryEntries.isActive, true), eq(dictionaryEntries.jlptLevel, level))
    : eq(dictionaryEntries.isActive, true);
  const [countRows] = await db.select({ value: count() }).from(dictionaryEntries).where(filter);
  const total = countRows?.value ?? 0;
  if (!total) return { items: [], total: 0 };
  const maxOffset = Math.max(0, total - limit);
  const offset = Math.floor(Math.random() * (maxOffset + 1));
  const rows = await db
    .select()
    .from(dictionaryEntries)
    .where(filter)
    .orderBy(asc(dictionaryEntries.id))
    .limit(limit)
    .offset(offset);
  return { items: rows.map(dictionaryDto), total };
}

export async function bulkDictionaryEntries(ids: string[]): Promise<DictionaryEntryDto[]> {
  if (!ids.length) return [];
  const rows = await getDatabase()
    .select()
    .from(dictionaryEntries)
    .where(and(inArray(dictionaryEntries.id, ids), eq(dictionaryEntries.isActive, true)));
  const order = new Map(ids.map((id, index) => [id, index]));
  rows.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  return rows.map(dictionaryDto);
}
