import { userProgress, users } from "@nihongobridge/knowledge";
import { eq, sql } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db";
import type { SessionAnswer, TestSectionType } from "@/types/test";

export interface ProgressQuestion {
  id: string;
  sectionType: TestSectionType;
  correctAnswer: string;
  vocabularyIds: string[];
  grammarIds: string[];
}

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

interface ItemAggregate {
  itemType: "word" | "grammar";
  itemId: string;
  attempts: number;
  correct: number;
}

export async function applyXpAndProgress(
  transaction: Transaction,
  userId: string,
  questions: ProgressQuestion[],
  answers: Record<string, SessionAnswer>,
): Promise<number> {
  const correctAnswers = questions.filter(
    (question) => answers[question.id]?.selected === question.correctAnswer,
  ).length;
  const xpEarned = 10 + correctAnswers * 2;

  await transaction
    .update(users)
    .set({
      xpTotal: sql`${users.xpTotal} + ${xpEarned}`,
      streakDays: sql`CASE
        WHEN ${users.lastStudyDate} = current_date THEN ${users.streakDays}
        WHEN ${users.lastStudyDate} = current_date - 1 THEN ${users.streakDays} + 1
        ELSE 1
      END`,
      lastStudyDate: sql`current_date`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  const aggregates = aggregateContent(questions, answers);
  for (const aggregate of aggregates) {
    const accuracy = aggregate.correct / aggregate.attempts;
    await transaction
      .insert(userProgress)
      .values({
        userId,
        itemType: aggregate.itemType,
        itemId: aggregate.itemId,
        status: "learning",
        accuracy,
        studyCount: aggregate.attempts,
        lastStudiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.itemType, userProgress.itemId],
        set: {
          accuracy: sql`(
            (${userProgress.accuracy} * ${userProgress.studyCount}) + ${aggregate.correct}
          ) / (${userProgress.studyCount} + ${aggregate.attempts})`,
          studyCount: sql`${userProgress.studyCount} + ${aggregate.attempts}`,
          status: sql`CASE
            WHEN (${userProgress.studyCount} + ${aggregate.attempts}) >= 5
              AND (((${userProgress.accuracy} * ${userProgress.studyCount}) + ${aggregate.correct})
                / (${userProgress.studyCount} + ${aggregate.attempts})) >= 0.9
              THEN 'mastered'::progress_status
            WHEN (${userProgress.studyCount} + ${aggregate.attempts}) >= 3
              THEN 'reviewing'::progress_status
            ELSE 'learning'::progress_status
          END`,
          lastStudiedAt: new Date(),
        },
      });
  }
  return xpEarned;
}

function aggregateContent(
  questions: ProgressQuestion[],
  answers: Record<string, SessionAnswer>,
): ItemAggregate[] {
  const aggregate = new Map<string, ItemAggregate>();
  for (const question of questions) {
    const correct = answers[question.id]?.selected === question.correctAnswer ? 1 : 0;
    for (const [itemType, ids] of [
      ["word", question.vocabularyIds],
      ["grammar", question.grammarIds],
    ] as const) {
      for (const itemId of ids) {
        const key = `${itemType}:${itemId}`;
        const current = aggregate.get(key) ?? {
          itemType,
          itemId,
          attempts: 0,
          correct: 0,
        };
        current.attempts += 1;
        current.correct += correct;
        aggregate.set(key, current);
      }
    }
  }
  return [...aggregate.values()];
}
