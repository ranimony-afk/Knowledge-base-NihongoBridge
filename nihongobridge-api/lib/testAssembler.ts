import { practiceTests, questions, testSessions } from "@nihongobridge/knowledge";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDatabase } from "@/lib/db";
import type {
  RequestedTestType,
  TestLevel,
  TestSectionState,
  TestSectionType,
} from "@/types/test";

const DEFAULT_COUNTS: Record<TestSectionType, number> = {
  vocabulary: 20,
  grammar: 15,
  reading: 10,
  listening: 15,
};
const SECTION_MINUTES: Record<TestSectionType, number> = {
  vocabulary: 25,
  grammar: 20,
  reading: 40,
  listening: 30,
};

interface AssemblerParameters {
  level: TestLevel;
  testType: RequestedTestType;
  section?: TestSectionType | undefined;
  userId: string;
  sectionCount?: number;
}

interface CandidateRow extends Record<string, unknown> {
  id: string;
  difficulty: number;
}

export interface AssembledPracticeTest {
  testId: string;
  created: boolean;
}

export async function getOrCreatePracticeTest(
  parameters: AssemblerParameters,
): Promise<AssembledPracticeTest> {
  if (parameters.testType === "section_drill" && !parameters.section) {
    throw new Error("section is required for a section drill");
  }
  const db = getDatabase();
  const databaseType = parameters.testType === "full_mock" ? "mock_full" : "section_only";
  const sectionFilter = parameters.section
    ? sql`pt.sections @> ${JSON.stringify([{ type: parameters.section }])}::jsonb`
    : sql`true`;
  const existing = await db.execute<{ id: string }>(sql`
    SELECT pt.id::text AS id
    FROM practice_tests AS pt
    WHERE pt.level = ${parameters.level}::jlpt_test_level
      AND pt.test_type = ${databaseType}::test_type
      AND pt.is_published = true
      AND ${sectionFilter}
      AND NOT EXISTS (
        SELECT 1 FROM test_sessions AS ts
        WHERE ts.test_id = pt.id AND ts.user_id = ${parameters.userId}::uuid
      )
    ORDER BY pt.created_at DESC
    LIMIT 1
  `);
  if (existing[0]) return { testId: existing[0].id, created: false };

  return db.transaction(async (transaction) => {
    const requested: Partial<Record<TestSectionType, number>> =
      parameters.testType === "full_mock"
        ? DEFAULT_COUNTS
        : { [parameters.section!]: parameters.sectionCount ?? 20 };
    const recentRows = await transaction.execute<{ question_id: string }>(sql`
      SELECT DISTINCT answer->>'question_id' AS question_id
      FROM (
        SELECT answers
        FROM test_sessions
        WHERE user_id = ${parameters.userId}::uuid
        ORDER BY started_at DESC
        LIMIT 20
      ) AS recent
      CROSS JOIN LATERAL jsonb_array_elements(recent.answers) AS expanded(answer)
      WHERE answer ? 'question_id'
    `);
    const recentIds = recentRows.map((row) => row.question_id);
    const recentFilter = recentIds.length
      ? sql`id NOT IN (${sql.join(
          recentIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`
      : sql`true`;
    const selected = new Map<TestSectionType, CandidateRow[]>();
    const salt = randomUUID();

    for (const [section, count] of Object.entries(requested) as Array<
      [TestSectionType, number]
    >) {
      const candidates = await transaction.execute<CandidateRow>(sql`
        SELECT id::text AS id, difficulty
        FROM questions
        WHERE jlpt_level = ${parameters.level}::jlpt_level
          AND section_type = ${section}::question_section_type
          AND source = 'generated'
          AND is_active = true
          AND test_id IS NULL
          AND ${recentFilter}
        ORDER BY md5(id::text || ${salt}), difficulty
        LIMIT ${count * 5}
        FOR UPDATE SKIP LOCKED
      `);
      const balanced = balanceDifficulty([...candidates], count);
      if (balanced.length < count) {
        throw new Error(
          `Insufficient unused ${parameters.level} ${section} questions: ` +
            `needed ${count}, found ${balanced.length}`,
        );
      }
      selected.set(section, balanced);
    }

    const testId = randomUUID();
    const sections: TestSectionState[] = [];
    const selectedQuestions: CandidateRow[] = [];
    for (const [section, candidates] of selected) {
      const baseline = DEFAULT_COUNTS[section];
      const timeMinutes = Math.max(
        1,
        Math.ceil((SECTION_MINUTES[section] * candidates.length) / baseline),
      );
      sections.push({
        type: section,
        time_minutes: timeMinutes,
        question_ids: candidates.map((candidate) => candidate.id),
      });
      selectedQuestions.push(...candidates);
    }
    const averageDifficulty =
      selectedQuestions.reduce((sum, candidate) => sum + candidate.difficulty, 0) /
      selectedQuestions.length;
    const title =
      parameters.testType === "full_mock"
        ? `${parameters.level} Original Mock Test`
        : `${parameters.level} ${parameters.section} Drill`;

    await transaction.insert(practiceTests).values({
      id: testId,
      title,
      level: parameters.level,
      testType: databaseType,
      sections,
      totalTimeMinutes: sections.reduce((sum, section) => sum + section.time_minutes, 0),
      difficultyScore: Math.round(averageDifficulty * 1_000) / 1_000,
      tags: ["generated", "original", "knowledge-base-only"],
      isPublished: true,
      createdBy: parameters.userId,
    });
    const questionIds = selectedQuestions.map((candidate) => candidate.id);
    const updated = await transaction
      .update(questions)
      .set({ testId })
      .where(and(inArray(questions.id, questionIds), isNull(questions.testId)))
      .returning({ id: questions.id });
    if (updated.length !== questionIds.length) {
      throw new Error("Concurrent test assembly changed the selected question pool");
    }
    return { testId, created: true };
  });
}

export async function deleteUnstartedSession(sessionId: string): Promise<void> {
  await getDatabase().delete(testSessions).where(eq(testSessions.id, sessionId));
}

function balanceDifficulty(candidates: CandidateRow[], count: number): CandidateRow[] {
  const buckets = new Map<number, CandidateRow[]>([
    [1, []],
    [2, []],
    [3, []],
    [4, []],
    [5, []],
  ]);
  for (const candidate of candidates) buckets.get(candidate.difficulty)?.push(candidate);
  const output: CandidateRow[] = [];
  while (output.length < count && [...buckets.values()].some((bucket) => bucket.length)) {
    for (const difficulty of [2, 3, 1, 4, 5]) {
      const candidate = buckets.get(difficulty)?.pop();
      if (candidate && output.length < count) output.push(candidate);
    }
  }
  return output;
}
