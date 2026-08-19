import {
  dictionaryEntries,
  grammarPatterns,
  practiceTests,
  questions,
  testSessions,
  users,
} from "@nihongobridge/knowledge";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  type SQL,
} from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { TestEngineError, toPublicQuestion } from "@/lib/testEngine";
import type { ReviewQuestion, TestSectionState, TestSectionType } from "@/types/test";

export async function getTestReview(sessionId: string, userId: string) {
  const db = getDatabase();
  const [session] = await db
    .select()
    .from(testSessions)
    .where(and(eq(testSessions.id, sessionId), eq(testSessions.userId, userId)))
    .limit(1);
  if (!session) throw new TestEngineError("Test session not found", 404);
  if (!session.completedAt) throw new TestEngineError("Review is available after completion", 409);

  const [test] = await db
    .select()
    .from(practiceTests)
    .where(eq(practiceTests.id, session.testId))
    .limit(1);
  if (!test) throw new TestEngineError("Practice test not found", 404);
  const sections = test.sections as TestSectionState[];
  const orderedIds = sections.flatMap((section) => section.question_ids);
  const questionRows = orderedIds.length
    ? await db.select().from(questions).where(inArray(questions.id, orderedIds))
    : [];
  const byId = new Map(questionRows.map((question) => [question.id, question]));
  const orderedQuestions = orderedIds
    .map((id) => byId.get(id))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const vocabularyIds = [...new Set(orderedQuestions.flatMap((row) => row.vocabularyIds))];
  const grammarIds = [...new Set(orderedQuestions.flatMap((row) => row.grammarIds))];
  const [vocabularyRows, grammarRows] = await Promise.all([
    vocabularyIds.length
      ? db.select().from(dictionaryEntries).where(inArray(dictionaryEntries.id, vocabularyIds))
      : [],
    grammarIds.length
      ? db.select().from(grammarPatterns).where(inArray(grammarPatterns.id, grammarIds))
      : [],
  ]);
  const vocabulary = new Map(vocabularyRows.map((row) => [row.id, row]));
  const grammar = new Map(grammarRows.map((row) => [row.id, row]));
  const answers = new Map(
    session.answers
      .filter((answer) => Boolean(answer.selected))
      .map((answer) => [answer.question_id, answer.selected]),
  );

  const reviewed: ReviewQuestion[] = orderedQuestions.map((row) => {
    const userAnswer = answers.get(row.id) ?? null;
    return {
      ...toPublicQuestionForReview(row),
      correct_answer: row.correctAnswer,
      explanation_jp: row.explanationJp,
      explanation_en: row.explanationEn,
      user_answer: userAnswer,
      is_correct: userAnswer === row.correctAnswer,
      vocabulary: row.vocabularyIds.flatMap((id) => {
        const item = vocabulary.get(id);
        return item
          ? [{ id: item.id, word: item.word, kana: item.kana, meanings: item.meanings }]
          : [];
      }),
      grammar: row.grammarIds.flatMap((id) => {
        const item = grammar.get(id);
        return item ? [{ id: item.id, pattern: item.pattern, meaning: item.meaning }] : [];
      }),
    };
  });

  await db.update(testSessions).set({ reviewMode: true }).where(eq(testSessions.id, sessionId));
  return {
    session_id: session.id,
    test_id: session.testId,
    score_total: session.scoreTotal,
    score_by_section: session.scoreBySection,
    passed: session.passed,
    sections,
    questions: reviewed,
  };
}

export async function getTestHistory(parameters: {
  userId: string;
  level?: "N5" | "N4" | "N3" | "N2" | "N1" | undefined;
  page: number;
  limit: number;
}) {
  const conditions: SQL[] = [
    eq(testSessions.userId, parameters.userId),
    isNotNull(testSessions.completedAt),
  ];
  if (parameters.level) conditions.push(eq(practiceTests.level, parameters.level));
  const where = and(...conditions);
  const db = getDatabase();
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: testSessions.id,
        testId: testSessions.testId,
        title: practiceTests.title,
        level: practiceTests.level,
        testType: practiceTests.testType,
        startedAt: testSessions.startedAt,
        completedAt: testSessions.completedAt,
        timeSpentSeconds: testSessions.timeSpentSeconds,
        scoreTotal: testSessions.scoreTotal,
        scoreBySection: testSessions.scoreBySection,
        passed: testSessions.passed,
      })
      .from(testSessions)
      .innerJoin(practiceTests, eq(testSessions.testId, practiceTests.id))
      .where(where)
      .orderBy(desc(testSessions.startedAt))
      .limit(parameters.limit + 1)
      .offset((parameters.page - 1) * parameters.limit),
    db
      .select({ value: count() })
      .from(testSessions)
      .innerJoin(practiceTests, eq(testSessions.testId, practiceTests.id))
      .where(where),
  ]);
  const items = rows.slice(0, parameters.limit).map((row, index) => {
    const older = rows[index + 1];
    return {
      id: row.id,
      test_id: row.testId,
      title: row.title,
      level: row.level,
      test_type: row.testType,
      started_at: row.startedAt.toISOString(),
      completed_at: row.completedAt?.toISOString() ?? null,
      time_spent_seconds: row.timeSpentSeconds,
      score_total: row.scoreTotal,
      score_by_section: row.scoreBySection,
      passed: row.passed,
      score_change:
        row.scoreTotal !== null && older?.scoreTotal !== null && older?.scoreTotal !== undefined
          ? Math.round((row.scoreTotal - older.scoreTotal) * 10) / 10
          : null,
    };
  });
  return { items, total: totals[0]?.value ?? 0 };
}

export async function getAdminTestQuestions(parameters: {
  testId: string;
  section?: TestSectionType | undefined;
  page: number;
  limit: number;
}) {
  const conditions: SQL[] = [eq(questions.testId, parameters.testId)];
  if (parameters.section) conditions.push(eq(questions.sectionType, parameters.section));
  const where = and(...conditions);
  const db = getDatabase();
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(where)
      .orderBy(asc(questions.sectionType), asc(questions.createdAt))
      .limit(parameters.limit)
      .offset((parameters.page - 1) * parameters.limit),
    db.select({ value: count() }).from(questions).where(where),
  ]);
  return {
    items: rows.map((row) => ({
      ...toPublicQuestionForReview(row),
      correct_answer: row.correctAnswer,
      explanation_jp: row.explanationJp,
      explanation_en: row.explanationEn,
      vocabulary_ids: row.vocabularyIds,
      grammar_ids: row.grammarIds,
      source: row.source,
      is_active: row.isActive,
    })),
    total: totals[0]?.value ?? 0,
  };
}

export async function getUserTestAnalytics(userId: string) {
  const db = getDatabase();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new TestEngineError("User not found", 404);
  const sessions = await db
    .select({
      level: practiceTests.level,
      answers: testSessions.answers,
      startedAt: testSessions.startedAt,
    })
    .from(testSessions)
    .innerJoin(practiceTests, eq(testSessions.testId, practiceTests.id))
    .where(and(eq(testSessions.userId, userId), isNotNull(testSessions.completedAt)))
    .orderBy(desc(testSessions.startedAt))
    .limit(100);
  const questionIds = [...new Set(sessions.flatMap((session) => session.answers.map((a) => a.question_id)))];
  const questionRows = questionIds.length
    ? await db.select().from(questions).where(inArray(questions.id, questionIds))
    : [];
  const questionMap = new Map(questionRows.map((question) => [question.id, question]));

  const levelStats = new Map<string, { correct: number; total: number }>();
  const sectionStats = new Map<string, { correct: number; total: number }>();
  const recentAttempts: Array<{ type: string; correct: boolean }> = [];
  for (const session of sessions) {
    for (const answer of session.answers) {
      const question = questionMap.get(answer.question_id);
      if (!question) continue;
      const correct = answer.selected === question.correctAnswer;
      increment(levelStats, session.level, correct);
      increment(sectionStats, question.sectionType, correct);
      if (recentAttempts.length < 20) {
        const stimulus = question.stimulus as Record<string, unknown> | null;
        const type =
          (typeof stimulus?.generation_type === "string" && stimulus.generation_type) ||
          question.tags.find((tag) => tag.includes("selection") || tag.includes("reading")) ||
          question.sectionType;
        recentAttempts.push({ type, correct });
      }
    }
  }

  const weakMap = new Map<string, { correct: number; total: number }>();
  for (const attempt of recentAttempts) increment(weakMap, attempt.type, attempt.correct);
  const weakAreas = [...weakMap.entries()]
    .map(([type, stats]) => ({
      type,
      correct: stats.correct,
      attempts: stats.total,
      accuracy: percentage(stats.correct, stats.total),
    }))
    .filter((item) => item.accuracy < 60)
    .sort((left, right) => left.accuracy - right.accuracy);

  return {
    accuracy_by_level: statsObject(levelStats),
    accuracy_by_section: statsObject(sectionStats),
    streak: user.streakDays,
    weak_areas: weakAreas,
    recommended_next_study:
      weakAreas[0]?.type ?? (recentAttempts.length ? "take-an-adaptive-test" : "take-a-level-check"),
    attempts_analyzed: recentAttempts.length,
  };
}

function toPublicQuestionForReview(row: typeof questions.$inferSelect) {
  return {
    ...toPublicQuestion(row),
    stimulus: row.stimulus as Record<string, unknown> | null,
  };
}

function increment(
  target: Map<string, { correct: number; total: number }>,
  key: string,
  correct: boolean,
): void {
  const value = target.get(key) ?? { correct: 0, total: 0 };
  value.total += 1;
  if (correct) value.correct += 1;
  target.set(key, value);
}

function percentage(correct: number, total: number): number {
  return total ? Math.round((correct / total) * 1_000) / 10 : 0;
}

function statsObject(values: Map<string, { correct: number; total: number }>) {
  return Object.fromEntries(
    [...values.entries()].map(([key, value]) => [
      key,
      { ...value, accuracy: percentage(value.correct, value.total) },
    ]),
  );
}
