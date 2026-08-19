import {
  dictionaryEntries,
  grammarPatterns,
  questions,
  type GrammarPattern,
  type QuestionStimulus,
} from "@nihongobridge/knowledge";
import {
  and,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { aiExplanations, type AiExplanationKind } from "@/schema/ai";
import type { GeneratedQuestion, GenerateQuestionsInput } from "@/lib/validation";

export interface PromptGrammarContext {
  id: string;
  pattern: string;
  meaning: unknown;
  formation: string | null;
  examples: unknown;
  common_mistakes: string | null;
  jlpt_level: string;
  source: string;
}

export interface PromptVocabularyContext {
  id: string;
  word: string;
  kana: string | null;
  meanings: unknown;
  part_of_speech: string[];
  jlpt_level: string;
  source: string;
}

export interface KnowledgeGrounding {
  grammar: PromptGrammarContext[];
  vocabulary: PromptVocabularyContext[];
}

export interface CachedExplanation {
  response: Record<string, unknown>;
  responseText: string | null;
  model: string;
}

export class GeneratedQuestionValidationError extends Error {}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function grammarPromptRow(row: GrammarPattern): PromptGrammarContext {
  return {
    id: row.id,
    pattern: row.pattern,
    meaning: row.meaning,
    formation: row.formation,
    examples: row.examples,
    common_mistakes: row.commonMistakes,
    jlpt_level: row.jlptLevel,
    source: row.source,
  };
}

export async function getGrammarPattern(id: string): Promise<GrammarPattern | null> {
  const [row] = await getDatabase()
    .select()
    .from(grammarPatterns)
    .where(eq(grammarPatterns.id, id))
    .limit(1);
  return row ?? null;
}

export async function getTutorKnowledgeContext(
  currentTopic: string | undefined,
  recentMistakes: string[],
): Promise<KnowledgeGrounding> {
  const db = getDatabase();
  const mistakeIds = recentMistakes.filter(validUuid);
  const grammarConditions = [];
  const vocabularyConditions = [];

  if (currentTopic) {
    const pattern = `%${currentTopic}%`;
    grammarConditions.push(
      validUuid(currentTopic)
        ? eq(grammarPatterns.id, currentTopic)
        : or(
            ilike(grammarPatterns.pattern, pattern),
            ilike(grammarPatterns.patternPlain, pattern),
          ),
    );
  }
  if (mistakeIds.length) {
    grammarConditions.push(inArray(grammarPatterns.id, mistakeIds));
    vocabularyConditions.push(inArray(dictionaryEntries.id, mistakeIds));
  }

  const grammar = grammarConditions.length
    ? await db
        .select()
        .from(grammarPatterns)
        .where(or(...grammarConditions))
        .limit(12)
    : [];
  const vocabulary = vocabularyConditions.length
    ? await db
        .select({
          id: dictionaryEntries.id,
          word: dictionaryEntries.word,
          kana: dictionaryEntries.kana,
          meanings: dictionaryEntries.meanings,
          partOfSpeech: dictionaryEntries.partOfSpeech,
          jlptLevel: dictionaryEntries.jlptLevel,
          source: dictionaryEntries.source,
        })
        .from(dictionaryEntries)
        .where(or(...vocabularyConditions))
        .limit(12)
    : [];

  return {
    grammar: grammar.map(grammarPromptRow),
    vocabulary: vocabulary.map((row) => ({
      id: row.id,
      word: row.word,
      kana: row.kana,
      meanings: row.meanings,
      part_of_speech: row.partOfSpeech,
      jlpt_level: row.jlptLevel,
      source: row.source,
    })),
  };
}

export async function findQuestionGrounding(
  input: GenerateQuestionsInput,
): Promise<KnowledgeGrounding> {
  const db = getDatabase();
  const term = `%${input.topic}%`;
  const maybeId = validUuid(input.topic) ? input.topic : undefined;

  const grammar = await db
    .select()
    .from(grammarPatterns)
    .where(
      and(
        eq(grammarPatterns.jlptLevel, input.level),
        or(
          ...(maybeId ? [eq(grammarPatterns.id, maybeId)] : []),
          ilike(grammarPatterns.pattern, term),
          ilike(grammarPatterns.patternPlain, term),
          ilike(sql`${grammarPatterns.meaning}::text`, term),
          sql`${input.topic} = ANY(${grammarPatterns.tags})`,
        ),
      ),
    )
    .limit(20);

  const vocabulary = await db
    .select({
      id: dictionaryEntries.id,
      word: dictionaryEntries.word,
      kana: dictionaryEntries.kana,
      meanings: dictionaryEntries.meanings,
      partOfSpeech: dictionaryEntries.partOfSpeech,
      jlptLevel: dictionaryEntries.jlptLevel,
      source: dictionaryEntries.source,
    })
    .from(dictionaryEntries)
    .where(
      and(
        eq(dictionaryEntries.jlptLevel, input.level),
        eq(dictionaryEntries.isActive, true),
        or(
          ...(maybeId ? [eq(dictionaryEntries.id, maybeId)] : []),
          ilike(dictionaryEntries.word, term),
          ilike(dictionaryEntries.kana, term),
          ilike(sql`${dictionaryEntries.meanings}::text`, term),
          sql`${input.topic} = ANY(${dictionaryEntries.tags})`,
        ),
      ),
    )
    .limit(30);

  return {
    grammar: grammar.map(grammarPromptRow),
    vocabulary: vocabulary.map((row) => ({
      id: row.id,
      word: row.word,
      kana: row.kana,
      meanings: row.meanings,
      part_of_speech: row.partOfSpeech,
      jlpt_level: row.jlptLevel,
      source: row.source,
    })),
  };
}

export async function getCachedExplanation(
  cacheKey: string,
  kind: AiExplanationKind,
  userId?: string,
): Promise<CachedExplanation | null> {
  const db = getDatabase();
  const ownership = userId ? eq(aiExplanations.userId, userId) : isNull(aiExplanations.userId);
  const [row] = await db
    .select({
      id: aiExplanations.id,
      response: aiExplanations.response,
      responseText: aiExplanations.responseText,
      model: aiExplanations.model,
    })
    .from(aiExplanations)
    .where(
      and(
        eq(aiExplanations.cacheKey, cacheKey),
        eq(aiExplanations.kind, kind),
        ownership,
        or(isNull(aiExplanations.expiresAt), gt(aiExplanations.expiresAt, new Date())),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(aiExplanations)
    .set({ hitCount: sql`${aiExplanations.hitCount} + 1` })
    .where(eq(aiExplanations.id, row.id));
  return { response: row.response, responseText: row.responseText, model: row.model };
}

export interface SaveExplanationInput {
  kind: AiExplanationKind;
  cacheKey: string;
  grammarPatternId?: string;
  userId?: string;
  language: "en" | "ta" | "ml" | "hi" | "ja";
  userLevel: string;
  requestContext: Record<string, unknown>;
  response: Record<string, unknown>;
  responseText?: string;
  model: string;
  expiresAt?: Date;
}

export async function saveExplanation(input: SaveExplanationInput): Promise<void> {
  const values = {
    kind: input.kind,
    cacheKey: input.cacheKey,
    grammarPatternId: input.grammarPatternId ?? null,
    userId: input.userId ?? null,
    language: input.language,
    userLevel: input.userLevel,
    requestContext: input.requestContext,
    response: input.response,
    responseText: input.responseText ?? null,
    model: input.model,
    promptVersion: process.env.AI_PROMPT_VERSION ?? "hana-v1",
    expiresAt: input.expiresAt ?? null,
  };
  await getDatabase()
    .insert(aiExplanations)
    .values(values)
    .onConflictDoUpdate({
      target: aiExplanations.cacheKey,
      set: {
        requestContext: values.requestContext,
        response: values.response,
        responseText: values.responseText,
        model: values.model,
        promptVersion: values.promptVersion,
        expiresAt: values.expiresAt,
        updatedAt: new Date(),
      },
    });
}

export function validateQuestionGrounding(
  generated: GeneratedQuestion[],
  grounding: KnowledgeGrounding,
): void {
  const grammarIds = new Set(grounding.grammar.map((item) => item.id));
  const vocabularyIds = new Set(grounding.vocabulary.map((item) => item.id));
  const seen = new Set<string>();

  for (const question of generated) {
    const unknownGrammar = question.grounding_grammar_ids.find((id) => !grammarIds.has(id));
    const unknownVocabulary = question.grounding_vocabulary_ids.find(
      (id) => !vocabularyIds.has(id),
    );
    if (unknownGrammar || unknownVocabulary) {
      throw new Error("Generated question cited knowledge outside the supplied grounding set");
    }
    if (!question.grounding_grammar_ids.length && !question.grounding_vocabulary_ids.length) {
      throw new Error("Every generated question must cite at least one knowledge-base record");
    }
    const signature = `${question.question_jp ?? ""}\u0000${question.question_en ?? ""}`
      .normalize("NFKC")
      .toLocaleLowerCase();
    if (seen.has(signature)) throw new Error("Generated batch contains duplicate questions");
    seen.add(signature);
  }
}

export async function insertGeneratedQuestions(
  input: GenerateQuestionsInput,
  generated: GeneratedQuestion[],
  grounding: KnowledgeGrounding,
  model: string,
): Promise<string[]> {
  validateQuestionGrounding(generated, grounding);
  if (input.section === "reading" && generated.some((item) => !item.stimulus?.passage)) {
    throw new Error("Reading questions must include an original passage stimulus");
  }
  if (input.section === "listening" && generated.some((item) => !item.stimulus?.transcript?.length)) {
    throw new Error("Listening questions must include an original transcript stimulus");
  }

  const jpTexts = generated.flatMap((item) => item.question_jp ? [item.question_jp] : []);
  const enTexts = generated.flatMap((item) => item.question_en ? [item.question_en] : []);
  const duplicateConditions = [
    ...(jpTexts.length ? [inArray(questions.questionJp, jpTexts)] : []),
    ...(enTexts.length ? [inArray(questions.questionEn, enTexts)] : []),
  ];
  if (duplicateConditions.length) {
    const existing = await getDatabase()
      .select({ id: questions.id })
      .from(questions)
      .where(or(...duplicateConditions))
      .limit(1);
    if (existing.length) {
      throw new GeneratedQuestionValidationError(
        "A generated question already exists in the database",
      );
    }
  }

  const generatedAt = new Date().toISOString();
  const rows = generated.map((question) => {
    const metadata = {
      provenance: {
        kind: "knowledge-base-synthesis",
        copyrighted_exam_content: false,
        generated_at: generatedAt,
        model,
        grounding_vocabulary_ids: question.grounding_vocabulary_ids,
        grounding_grammar_ids: question.grounding_grammar_ids,
      },
    };
    const stimulus: QuestionStimulus = { metadata };
    if (question.stimulus?.kind) stimulus.kind = question.stimulus.kind;
    if (question.stimulus?.passage) stimulus.passage = question.stimulus.passage;
    if (question.stimulus?.transcript) {
      stimulus.transcript = question.stimulus.transcript.map((line) => ({
        speaker: line.speaker,
        text: line.text,
        ...(line.reading ? { reading: line.reading } : {}),
      }));
    }
    return {
      sectionType: input.section,
      questionJp: question.question_jp,
      questionEn: question.question_en,
      stimulus,
      options: question.options,
      correctAnswer: question.correct_answer,
      explanationJp: question.explanation_jp,
      explanationEn: question.explanation_en,
      vocabularyIds: question.grounding_vocabulary_ids,
      grammarIds: question.grounding_grammar_ids,
      difficulty: question.difficulty,
      jlptLevel: input.level,
      timeLimitSeconds: question.time_limit_seconds,
      tags: [...new Set([...question.tags, "ai-generated", "admin-review-required"])],
      source: "generated" as const,
      isActive: false,
    };
  });

  const inserted = await getDatabase()
    .insert(questions)
    .values(rows)
    .returning({ id: questions.id });
  return inserted.map((row) => row.id);
}
