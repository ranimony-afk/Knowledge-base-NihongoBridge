import {
  grammarPatterns,
  sentenceGrammarLinks,
  sentences,
} from "@nihongobridge/knowledge";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  notInArray,
  sql,
} from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { grammarDetailDto, grammarDto, sentenceDto } from "@/lib/serializers";
import type { GrammarDetailDto, GrammarSummaryDto } from "@/types/api";

export async function searchGrammar(parameters: {
  q: string;
  level?: "N5" | "N4" | "N3" | "N2" | "N1" | undefined;
  page: number;
  limit: number;
}): Promise<{ items: GrammarDetailDto[]; total: number }> {
  const vector = sql`(
    setweight(to_tsvector('simple', coalesce(${grammarPatterns.pattern}, '') || ' ' || coalesce(${grammarPatterns.patternPlain}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${grammarPatterns.meaning}::text, '')), 'B')
  )`;
  const simpleQuery = sql`plainto_tsquery('simple', ${parameters.q})`;
  const englishQuery = sql`plainto_tsquery('english', ${parameters.q})`;
  const filters = [
    sql`(
      ${vector} @@ ${simpleQuery}
      OR ${vector} @@ ${englishQuery}
      OR strpos(${grammarPatterns.pattern}, ${parameters.q}) > 0
      OR strpos(lower(${grammarPatterns.meaning}::text), lower(${parameters.q})) > 0
    )`,
  ];
  if (parameters.level) filters.push(eq(grammarPatterns.jlptLevel, parameters.level));
  const where = and(...filters);
  const rank = sql<number>`greatest(
    ts_rank_cd(${vector}, ${simpleQuery}),
    ts_rank_cd(${vector}, ${englishQuery}),
    similarity(${grammarPatterns.pattern}, ${parameters.q})
  )`;
  const db = getDatabase();
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(grammarPatterns)
      .where(where)
      .orderBy(desc(rank), asc(grammarPatterns.pattern))
      .limit(parameters.limit)
      .offset((parameters.page - 1) * parameters.limit),
    db.select({ value: count() }).from(grammarPatterns).where(where),
  ]);
  return { items: rows.map(grammarDetailDto), total: totals[0]?.value ?? 0 };
}

export async function getGrammarDetail(
  id: string,
): Promise<(GrammarDetailDto & { related_patterns: GrammarSummaryDto[] }) | null> {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(grammarPatterns)
    .where(eq(grammarPatterns.id, id))
    .limit(1);
  if (!row) return null;
  const related = row.relatedPatternIds.length
    ? await db
        .select()
        .from(grammarPatterns)
        .where(inArray(grammarPatterns.id, row.relatedPatternIds))
    : [];
  return { ...grammarDetailDto(row), related_patterns: related.map(grammarDto) };
}

export async function listGrammarByLevel(
  level: "N5" | "N4" | "N3" | "N2" | "N1",
  page: number,
  limit: number,
): Promise<{ items: GrammarDetailDto[]; total: number }> {
  const db = getDatabase();
  const where = eq(grammarPatterns.jlptLevel, level);
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(grammarPatterns)
      .where(where)
      .orderBy(asc(grammarPatterns.pattern))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(grammarPatterns).where(where),
  ]);
  return { items: rows.map(grammarDetailDto), total: totals[0]?.value ?? 0 };
}

export async function generateGrammarQuiz(id: string) {
  const db = getDatabase();
  const [grammar] = await db
    .select()
    .from(grammarPatterns)
    .where(eq(grammarPatterns.id, id))
    .limit(1);
  if (!grammar) return null;

  const links = await db
    .select({ id: sentenceGrammarLinks.sentenceId })
    .from(sentenceGrammarLinks)
    .where(eq(sentenceGrammarLinks.grammarPatternId, id))
    .limit(20);
  const linkedIds = links.map((link) => link.id);
  const correctRows = linkedIds.length
    ? await db.select().from(sentences).where(inArray(sentences.id, linkedIds)).limit(20)
    : await db
        .select()
        .from(sentences)
        .where(sql`${sentences.grammarIds} @> ARRAY[${id}::uuid]`)
        .limit(20);
  const uniqueCorrect = uniqueSentences(correctRows);
  if (!uniqueCorrect.length) return { grammar: grammarDetailDto(grammar), quiz: null };

  const correct = uniqueCorrect[Math.floor(Math.random() * uniqueCorrect.length)]!;
  const excluded = [...new Set([...linkedIds, correct.id])];
  const distractorRows = await db
    .select()
    .from(sentences)
    .where(
      and(
        eq(sentences.jlptLevel, grammar.jlptLevel),
        ...(excluded.length ? [notInArray(sentences.id, excluded)] : []),
        sql`NOT (${sentences.grammarIds} @> ARRAY[${id}::uuid])`,
        sql`NOT EXISTS (
          SELECT 1 FROM sentence_grammar_links AS sgl
          WHERE sgl.sentence_id = ${sentences.id}
            AND sgl.grammar_pattern_id = ${id}::uuid
        )`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(20);
  const distractors = uniqueSentences(distractorRows)
    .filter((sentence) => sentence.japanese !== correct.japanese)
    .slice(0, 3);
  if (distractors.length < 3) return { grammar: grammarDetailDto(grammar), quiz: null };

  const shuffled = [correct, ...distractors]
    .map((sentence) => ({ sentence, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ sentence }) => sentence);
  const optionIds = ["a", "b", "c", "d"];
  const options = shuffled.map((sentence, index) => ({
    id: optionIds[index]!,
    text_jp: sentence.japanese,
    text_en:
      sentence.translations.find((translation) => translation.lang === "en")?.value ?? "",
  }));
  const correctAnswer = options[shuffled.findIndex((sentence) => sentence.id === correct.id)]!.id;
  return {
    grammar: grammarDetailDto(grammar),
    quiz: {
      question_jp: `「${grammar.pattern}」を正しく使っている文を選んでください。`,
      question_en: `Choose the sentence that correctly uses ${grammar.pattern}.`,
      options,
      correct_answer: correctAnswer,
      explanation: grammar.meaning,
      correct_sentence: sentenceDto(correct),
    },
  };
}

function uniqueSentences<T extends typeof sentences.$inferSelect>(rows: T[]): T[] {
  return rows.filter(
    (row, index, values) =>
      values.findIndex((candidate) => candidate.japanese === row.japanese) === index,
  );
}
