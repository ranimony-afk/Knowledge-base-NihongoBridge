import {
  practiceTests,
  questions,
  testSessions,
} from "@nihongobridge/knowledge";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDatabase } from "@/lib/db";
import { calculateTestScore, type ScorableQuestion } from "@/lib/scoring";
import {
  acquireCompletionLock,
  createSession,
  getSession,
  sessionTiming,
  updateSession,
} from "@/lib/session";
import { deleteUnstartedSession, getOrCreatePracticeTest } from "@/lib/testAssembler";
import { applyXpAndProgress, type ProgressQuestion } from "@/lib/xp";
import type {
  CompleteTestResponse,
  PublicTestQuestion,
  RequestedTestType,
  SessionAnswer,
  StartTestResponse,
  TestLevel,
  TestSectionState,
  TestSectionType,
  TestSessionState,
} from "@/types/test";

type QuestionRow = typeof questions.$inferSelect;

interface StartParameters {
  level: TestLevel;
  testType: RequestedTestType;
  section?: TestSectionType | undefined;
  userId: string;
}

export async function startTestSession(parameters: StartParameters): Promise<StartTestResponse> {
  const assembled = await getOrCreatePracticeTest({
    level: parameters.level,
    testType: parameters.testType,
    section: parameters.section,
    userId: parameters.userId,
  });
  const definition = await loadTestDefinition(assembled.testId);
  const sessionId = randomUUID();
  const startedAt = new Date();
  const deadline = new Date(startedAt.getTime() + definition.totalTimeMinutes * 60_000);
  const state: TestSessionState = {
    version: 1,
    session_id: sessionId,
    test_id: assembled.testId,
    user_id: parameters.userId,
    level: parameters.level,
    test_type: parameters.testType,
    sections: definition.sections,
    questions: definition.questions,
    current_index: 0,
    answers: {},
    started_at: startedAt.toISOString(),
    deadline_at: deadline.toISOString(),
    status: "active",
  };

  await getDatabase().insert(testSessions).values({
    id: sessionId,
    userId: parameters.userId,
    testId: assembled.testId,
    startedAt,
    timeSpentSeconds: 0,
    answers: [],
    reviewMode: false,
  });
  try {
    await createSession(state);
  } catch (error) {
    await deleteUnstartedSession(sessionId);
    throw error;
  }

  return {
    session_id: sessionId,
    test_id: assembled.testId,
    sections: definition.sections,
    first_question: definition.questions[0] ?? null,
    time_remaining_seconds: definition.totalTimeMinutes * 60,
  };
}

export async function completeTestSession(
  sessionId: string,
  userId: string,
): Promise<CompleteTestResponse> {
  const release = await acquireCompletionLock(sessionId);
  try {
    const db = getDatabase();
    const [sessionRow] = await db
      .select()
      .from(testSessions)
      .where(and(eq(testSessions.id, sessionId), eq(testSessions.userId, userId)))
      .limit(1);
    if (!sessionRow) throw new TestEngineError("Test session not found", 404);

    const [test] = await db
      .select()
      .from(practiceTests)
      .where(eq(practiceTests.id, sessionRow.testId))
      .limit(1);
    if (!test) throw new TestEngineError("Practice test not found", 404);
    const requestedType: RequestedTestType =
      test.testType === "mock_full" ? "full_mock" : "section_drill";

    if (sessionRow.completedAt) {
      return completedResponse(
        sessionRow,
        await loadScorableQuestions(sessionRow.testId),
        requestedType,
      );
    }

    const state = await getSession(sessionId);
    if (!state) throw new TestEngineError("Session state expired or is unavailable", 410);
    if (state.user_id !== userId) throw new TestEngineError("Forbidden", 403);

    const scorable = await loadScorableQuestions(state.test_id);
    const score = calculateTestScore(scorable, state.answers, state.test_type);
    const timing = sessionTiming(state);
    const completedAt = new Date();
    const persistedAnswers = state.questions.map((question) => {
      const answer = state.answers[question.id];
      return {
        question_id: question.id,
        selected: answer?.selected ?? "",
        time_taken: answer?.time_taken_ms ?? 0,
      };
    });
    const progressQuestions: ProgressQuestion[] = scorable.map((question) => ({
      id: question.id,
      sectionType: question.sectionType,
      correctAnswer: question.correctAnswer,
      vocabularyIds: question.vocabularyIds,
      grammarIds: question.grammarIds,
    }));

    const xpEarned = await db.transaction(async (transaction) => {
      const finalized = await transaction
        .update(testSessions)
        .set({
          completedAt,
          timeSpentSeconds: timing.elapsed,
          answers: persistedAnswers,
          scoreTotal: score.score_total,
          scoreBySection: score.score_by_section,
          passed: score.passed,
        })
        .where(and(eq(testSessions.id, sessionId), isNull(testSessions.completedAt)))
        .returning({ id: testSessions.id });
      if (!finalized.length) {
        throw new TestEngineError("Test session was already finalized", 409);
      }
      return applyXpAndProgress(transaction, userId, progressQuestions, state.answers);
    });

    try {
      await updateSession(sessionId, (current) => ({
        ...current,
        status: "completed",
        completed_at: completedAt.toISOString(),
      }));
    } catch (error) {
      console.warn("Could not mark completed Redis session", error);
    }

    return {
      ...score,
      time_spent: timing.elapsed,
      xp_earned: xpEarned,
      review_url: `/api/tests/session/${sessionId}/review`,
    };
  } finally {
    await release();
  }
}

interface TestDefinition {
  sections: TestSectionState[];
  questions: PublicTestQuestion[];
  totalTimeMinutes: number;
}

async function loadTestDefinition(testId: string): Promise<TestDefinition> {
  const db = getDatabase();
  const [test] = await db
    .select()
    .from(practiceTests)
    .where(and(eq(practiceTests.id, testId), eq(practiceTests.isPublished, true)))
    .limit(1);
  if (!test) throw new TestEngineError("Practice test is unavailable", 404);
  const sections = test.sections as TestSectionState[];
  const orderedIds = sections.flatMap((section) => section.question_ids);
  const rows = orderedIds.length
    ? await db
        .select()
        .from(questions)
        .where(and(inArray(questions.id, orderedIds), eq(questions.isActive, true)))
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const orderedRows = orderedIds.map((id) => byId.get(id)).filter(isQuestionRow);
  if (!orderedRows.length || orderedRows.length !== orderedIds.length) {
    throw new TestEngineError("Practice test has missing or inactive questions", 409);
  }
  return {
    sections,
    questions: orderedRows.map(toPublicQuestion),
    totalTimeMinutes: test.totalTimeMinutes,
  };
}

export function toPublicQuestion(row: QuestionRow): PublicTestQuestion {
  const stimulus: Record<string, unknown> | null = row.stimulus
    ? { ...row.stimulus }
    : null;
  if (stimulus && row.sectionType === "listening") {
    delete stimulus.transcript;
    delete stimulus.script;
  }
  return {
    id: row.id,
    section_type: row.sectionType,
    question_jp: row.questionJp,
    question_en: row.questionEn,
    stimulus,
    options: row.options,
    audio_url: row.audioUrl,
    image_url: row.imageUrl,
    difficulty: row.difficulty,
    jlpt_level: row.jlptLevel,
    time_limit_seconds: row.timeLimitSeconds,
    tags: row.tags,
  };
}

interface InternalScorableQuestion extends ScorableQuestion {
  vocabularyIds: string[];
  grammarIds: string[];
}

async function loadScorableQuestions(testId: string): Promise<InternalScorableQuestion[]> {
  const rows = await getDatabase()
    .select()
    .from(questions)
    .where(eq(questions.testId, testId));
  return rows.map((row) => ({
    id: row.id,
    sectionType: row.sectionType,
    correctAnswer: row.correctAnswer,
    vocabularyIds: row.vocabularyIds,
    grammarIds: row.grammarIds,
  }));
}

async function completedResponse(
  session: typeof testSessions.$inferSelect,
  scorable: InternalScorableQuestion[],
  testType: RequestedTestType,
): Promise<CompleteTestResponse> {
  const answers: Record<string, SessionAnswer> = {};
  for (const answer of session.answers) {
    answers[answer.question_id] = {
      question_id: answer.question_id,
      selected: answer.selected,
      time_taken_ms: answer.time_taken,
      answered_at: session.completedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
  const score = calculateTestScore(scorable, answers, testType);
  return {
    ...score,
    time_spent: session.timeSpentSeconds,
    xp_earned: 10 + score.correct_answers * 2,
    review_url: `/api/tests/session/${session.id}/review`,
  };
}

function isQuestionRow(value: QuestionRow | undefined): value is QuestionRow {
  return value !== undefined;
}

export class TestEngineError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
