import {
  dictionaryEntries,
  dictionaryKanjiLinks,
  kanjiEntries,
  kanjiEntryLinks,
} from "@nihongobridge/knowledge";
import {
  and,
  arrayContains,
  asc,
  count,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { dictionaryDto, kanjiDto } from "@/lib/serializers";
import type { KanjiDetailDto, KanjiEntryDto, KanjiQuizDto, KanjiQuizType } from "@/types/api";

export interface KanjiSearchParameters {
  q?: string | undefined;
  level?: "N5" | "N4" | "N3" | "N2" | "N1" | undefined;
  grade?: number | undefined;
  strokeMin?: number | undefined;
  strokeMax?: number | undefined;
  radical?: string | undefined;
  page: number;
  limit: number;
}

export async function getKanjiDetail(character: string): Promise<KanjiDetailDto | null> {
  const db = getDatabase();
  const [entry] = await db
    .select()
    .from(kanjiEntries)
    .where(eq(kanjiEntries.character, character))
    .limit(1);
  if (!entry) return null;

  const [exampleLinks, relatedLinks] = await Promise.all([
    db
      .select({ id: dictionaryKanjiLinks.dictionaryEntryId })
      .from(dictionaryKanjiLinks)
      .where(eq(dictionaryKanjiLinks.kanjiEntryId, entry.id))
      .orderBy(asc(dictionaryKanjiLinks.exampleRank))
      .limit(5),
    db
      .select({
        sourceId: kanjiEntryLinks.sourceKanjiId,
        targetId: kanjiEntryLinks.targetKanjiId,
      })
      .from(kanjiEntryLinks)
      .where(
        or(
          eq(kanjiEntryLinks.sourceKanjiId, entry.id),
          eq(kanjiEntryLinks.targetKanjiId, entry.id),
        ),
      ),
  ]);

  const exampleIds = exampleLinks.length
    ? exampleLinks.map((link) => link.id)
    : entry.exampleWordIds.slice(0, 5);
  const relatedIds = relatedLinks.map((link) =>
    link.sourceId === entry.id ? link.targetId : link.sourceId,
  );
  const relatedCharacters = [...entry.similarKanji, ...entry.lookalikes];

  const [wordRows, linkedRelatedRows, characterRelatedRows] = await Promise.all([
    exampleIds.length
      ? db
          .select()
          .from(dictionaryEntries)
          .where(
            and(
              inArray(dictionaryEntries.id, exampleIds),
              eq(dictionaryEntries.isActive, true),
            ),
          )
          .limit(5)
      : [],
    relatedIds.length
      ? db.select().from(kanjiEntries).where(inArray(kanjiEntries.id, relatedIds))
      : [],
    relatedCharacters.length
      ? db
          .select()
          .from(kanjiEntries)
          .where(inArray(kanjiEntries.character, relatedCharacters))
      : [],
  ]);

  const wordOrder = new Map(exampleIds.map((value, index) => [value, index]));
  wordRows.sort((left, right) => (wordOrder.get(left.id) ?? 0) - (wordOrder.get(right.id) ?? 0));
  const combinedRelated = [...linkedRelatedRows, ...characterRelatedRows].filter(
    (row, index, rows) => row.id !== entry.id && rows.findIndex((item) => item.id === row.id) === index,
  );

  return {
    ...kanjiDto(entry),
    example_words: wordRows.map(dictionaryDto),
    similar_kanji_details: combinedRelated.map(kanjiDto),
  };
}

export async function searchKanji(
  parameters: KanjiSearchParameters,
): Promise<{ items: KanjiEntryDto[]; total: number }> {
  const conditions: SQL[] = [];
  if (parameters.q) {
    const meaningVector = sql`to_tsvector('english', coalesce(${kanjiEntries.meanings}::text, ''))`;
    conditions.push(
      or(
        eq(kanjiEntries.character, parameters.q),
        arrayContains(kanjiEntries.onyomi, [parameters.q]),
        arrayContains(kanjiEntries.kunyomi, [parameters.q]),
        sql`${meaningVector} @@ plainto_tsquery('english', ${parameters.q})`,
        sql`strpos(lower(${kanjiEntries.meanings}::text), lower(${parameters.q})) > 0`,
      )!,
    );
  }
  if (parameters.level) conditions.push(eq(kanjiEntries.jlptLevel, parameters.level));
  if (parameters.grade !== undefined) conditions.push(eq(kanjiEntries.grade, parameters.grade));
  if (parameters.strokeMin !== undefined) {
    conditions.push(gte(kanjiEntries.strokeCount, parameters.strokeMin));
  }
  if (parameters.strokeMax !== undefined) {
    conditions.push(lte(kanjiEntries.strokeCount, parameters.strokeMax));
  }
  if (parameters.radical) {
    conditions.push(arrayContains(kanjiEntries.radicals, [parameters.radical]));
  }
  const where = and(...conditions);
  const db = getDatabase();
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(kanjiEntries)
      .where(where)
      .orderBy(asc(kanjiEntries.frequencyRank), asc(kanjiEntries.character))
      .limit(parameters.limit)
      .offset((parameters.page - 1) * parameters.limit),
    db.select({ value: count() }).from(kanjiEntries).where(where),
  ]);
  return { items: rows.map(kanjiDto), total: countRows[0]?.value ?? 0 };
}

export async function listKanjiByRadical(
  radical: string,
  page: number,
  limit: number,
): Promise<{ items: KanjiEntryDto[]; total: number }> {
  return searchKanji({ radical, page, limit });
}

export async function listKanjiByLevel(
  level: "N5" | "N4" | "N3" | "N2" | "N1",
  page: number,
  limit: number,
): Promise<{ items: KanjiEntryDto[]; total: number }> {
  return searchKanji({ level, page, limit });
}

export async function getKanjiQuiz(
  character: string,
  quizType: KanjiQuizType,
): Promise<KanjiQuizDto | null> {
  const db = getDatabase();
  const [entry] = await db
    .select()
    .from(kanjiEntries)
    .where(eq(kanjiEntries.character, character))
    .limit(1);
  if (!entry) return null;

  const hiddenFields: KanjiQuizDto["hidden_fields"] = [];
  const visible: KanjiQuizDto["visible"] = {
    stroke_count: entry.strokeCount,
    jlpt_level: entry.jlptLevel,
  };
  if (quizType === "meaning") {
    visible.onyomi = entry.onyomi;
    visible.kunyomi = entry.kunyomi;
    hiddenFields.push("meanings");
  } else if (quizType === "reading") {
    visible.meanings = entry.meanings;
    hiddenFields.push("onyomi", "kunyomi");
  } else {
    hiddenFields.push("onyomi", "kunyomi", "meanings");
  }

  return {
    character: entry.character,
    quiz_type: quizType,
    prompt:
      quizType === "reading"
        ? "この漢字の読み方は何ですか。"
        : quizType === "meaning"
          ? "この漢字の意味は何ですか。"
          : "この漢字の読み方と意味は何ですか。",
    visible,
    hidden_fields: hiddenFields,
  };
}
