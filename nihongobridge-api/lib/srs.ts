import {
  srsCards,
  srsDecks,
  srsReviewLogs,
  userProgress,
  users,
} from "@nihongobridge/knowledge";
import {
  and,
  asc,
  count,
  eq,
  gte,
  lte,
  sql,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  contentItemExists,
  contentKey,
  hydrateContentItems,
  type ContentItemType,
} from "@/lib/content";
import { getDatabase } from "@/lib/db";
import type { DueSrsCard, SrsConfidence, SrsSchedule } from "@/types/srs";

const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const DAY_MS = 86_400_000;

export class SrsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function calculateSm2Schedule(
  intervalDays: number,
  easeFactor: number,
  repetitions: number,
  confidence: SrsConfidence,
): SrsSchedule {
  let interval: number;
  let ease = easeFactor;
  let nextRepetitions = repetitions;

  if (confidence === "again") {
    interval = 1;
    ease -= 0.2;
    nextRepetitions = 0;
  } else if (confidence === "hard") {
    interval = intervalDays * 1.2;
    ease -= 0.15;
    nextRepetitions += 1;
  } else if (confidence === "good") {
    interval = intervalDays * easeFactor;
    nextRepetitions += 1;
  } else {
    interval = intervalDays * easeFactor * 1.3;
    ease += 0.15;
    nextRepetitions += 1;
  }

  return {
    intervalDays: Math.max(1, Math.round(interval)),
    easeFactor: Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, ease)) * 100) / 100,
    repetitions: nextRepetitions,
    wasCorrect: confidence !== "again",
  };
}

export async function getDueCards(parameters: {
  userId: string;
  limit: number;
  deckId?: string | undefined;
}): Promise<{ cards: DueSrsCard[]; total: number }> {
  const now = new Date();
  const filters = [eq(srsCards.userId, parameters.userId), lte(srsCards.nextReviewAt, now)];
  if (parameters.deckId) filters.push(eq(srsCards.deckId, parameters.deckId));
  const where = and(...filters);
  const db = getDatabase();
  const [cards, totals] = await Promise.all([
    db
      .select()
      .from(srsCards)
      .where(where)
      .orderBy(asc(srsCards.nextReviewAt), asc(srsCards.easeFactor))
      .limit(parameters.limit),
    db.select({ value: count() }).from(srsCards).where(where),
  ]);
  const hydrated = await hydrateContentItems(
    cards.map((card) => ({ itemType: card.itemType, itemId: card.itemId })),
  );
  return {
    cards: cards.map((card) => ({
      id: card.id,
      user_id: card.userId,
      item_type: card.itemType,
      item_id: card.itemId,
      ease_factor: card.easeFactor,
      interval_days: card.intervalDays,
      repetitions: card.repetitions,
      next_review_at: card.nextReviewAt.toISOString(),
      last_reviewed_at: card.lastReviewedAt?.toISOString() ?? null,
      total_reviews: card.totalReviews,
      correct_count: card.correctCount,
      mistake_count: card.mistakeCount,
      average_time_ms: card.averageTimeMs,
      confidence: card.confidence,
      deck_id: card.deckId,
      item: hydrated.get(contentKey(card.itemType, card.itemId)) ?? null,
    })),
    total: totals[0]?.value ?? 0,
  };
}

export async function reviewSrsCard(parameters: {
  cardId: string;
  userId: string;
  confidence: SrsConfidence;
  timeTakenMs: number;
}) {
  const db = getDatabase();
  return db.transaction(async (transaction) => {
    const [card] = await transaction
      .select()
      .from(srsCards)
      .where(and(eq(srsCards.id, parameters.cardId), eq(srsCards.userId, parameters.userId)))
      .for("update")
      .limit(1);
    if (!card) throw new SrsError("SRS card not found", 404);

    const schedule = calculateSm2Schedule(
      card.intervalDays,
      card.easeFactor,
      card.repetitions,
      parameters.confidence,
    );
    const now = new Date();
    const nextReviewAt = new Date(now.getTime() + schedule.intervalDays * DAY_MS);
    const totalReviews = card.totalReviews + 1;
    const correctCount = card.correctCount + (schedule.wasCorrect ? 1 : 0);
    const mistakeCount = card.mistakeCount + (schedule.wasCorrect ? 0 : 1);
    const averageTimeMs = Math.round(
      (card.averageTimeMs * card.totalReviews + parameters.timeTakenMs) / totalReviews,
    );

    await transaction
      .update(srsCards)
      .set({
        easeFactor: schedule.easeFactor,
        intervalDays: schedule.intervalDays,
        repetitions: schedule.repetitions,
        nextReviewAt,
        lastReviewedAt: now,
        totalReviews,
        correctCount,
        mistakeCount,
        averageTimeMs,
        confidence: parameters.confidence,
        updatedAt: now,
      })
      .where(eq(srsCards.id, card.id));
    await transaction.insert(srsReviewLogs).values({
      cardId: card.id,
      userId: card.userId,
      confidence: parameters.confidence,
      wasCorrect: schedule.wasCorrect,
      timeTakenMs: parameters.timeTakenMs,
      previousIntervalDays: card.intervalDays,
      nextIntervalDays: schedule.intervalDays,
      previousEaseFactor: card.easeFactor,
      nextEaseFactor: schedule.easeFactor,
      reviewedAt: now,
    });

    const cardAccuracy = correctCount / totalReviews;
    const progressStatus =
      schedule.repetitions >= 5 && schedule.intervalDays >= 21 && cardAccuracy >= 0.9
        ? "mastered"
        : schedule.repetitions >= 2
          ? "reviewing"
          : "learning";
    const reviewAccuracy = schedule.wasCorrect ? 1 : 0;
    await transaction
      .insert(userProgress)
      .values({
        userId: card.userId,
        itemType: card.itemType,
        itemId: card.itemId,
        status: progressStatus,
        accuracy: reviewAccuracy,
        studyCount: 1,
        lastStudiedAt: now,
      })
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.itemType, userProgress.itemId],
        set: {
          status: progressStatus,
          accuracy: sql`(
            (${userProgress.accuracy} * ${userProgress.studyCount}) + ${reviewAccuracy}
          ) / (${userProgress.studyCount} + 1)`,
          studyCount: sql`${userProgress.studyCount} + 1`,
          lastStudiedAt: now,
        },
      });

    const [remaining] = await transaction
      .select({ value: count() })
      .from(srsCards)
      .where(and(eq(srsCards.userId, card.userId), lte(srsCards.nextReviewAt, now)));
    return {
      next_review_at: nextReviewAt.toISOString(),
      interval_days: schedule.intervalDays,
      ease_factor: schedule.easeFactor,
      repetitions: schedule.repetitions,
      cards_remaining_today: remaining?.value ?? 0,
    };
  });
}

export async function addSrsCard(parameters: {
  userId: string;
  itemType: ContentItemType;
  itemId: string;
  deckId?: string | undefined;
}) {
  if (!(await contentItemExists(parameters.itemType, parameters.itemId))) {
    throw new SrsError("Referenced content item does not exist", 404);
  }
  const db = getDatabase();
  if (parameters.deckId) {
    const [deck] = await db
      .select({ id: srsDecks.id })
      .from(srsDecks)
      .where(and(eq(srsDecks.id, parameters.deckId), eq(srsDecks.userId, parameters.userId)))
      .limit(1);
    if (!deck) throw new SrsError("SRS deck not found", 404);
  }
  const [existing] = await db
    .select()
    .from(srsCards)
    .where(
      and(
        eq(srsCards.userId, parameters.userId),
        eq(srsCards.itemType, parameters.itemType),
        eq(srsCards.itemId, parameters.itemId),
      ),
    )
    .limit(1);
  if (existing) throw new SrsError("Item is already in the user's SRS queue", 409);

  try {
    const [created] = await db
      .insert(srsCards)
      .values({
        id: randomUUID(),
        userId: parameters.userId,
        itemType: parameters.itemType,
        itemId: parameters.itemId,
        ...(parameters.deckId ? { deckId: parameters.deckId } : {}),
        nextReviewAt: new Date(),
      })
      .returning();
    return created!;
  } catch (error) {
    if (postgresErrorCode(error) === "23505") {
      throw new SrsError("Item is already in the user's SRS queue", 409);
    }
    throw error;
  }
}

export async function getSrsStats(userId: string) {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const db = getDatabase();
  const [dueRows, studiedRows, masteredRows, accuracyRows, userRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(srsCards)
      .where(and(eq(srsCards.userId, userId), lte(srsCards.nextReviewAt, now))),
    db
      .select({ value: count() })
      .from(srsReviewLogs)
      .where(and(eq(srsReviewLogs.userId, userId), gte(srsReviewLogs.reviewedAt, startToday))),
    db
      .select({ value: count() })
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.status, "mastered"))),
    db
      .select({
        total: count(),
        correct: sql<number>`count(*) FILTER (WHERE ${srsReviewLogs.wasCorrect} = true)`,
      })
      .from(srsReviewLogs)
      .where(
        and(eq(srsReviewLogs.userId, userId), gte(srsReviewLogs.reviewedAt, thirtyDaysAgo)),
      ),
    db.select({ streak: users.streakDays }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  if (!userRows[0]) throw new SrsError("User not found", 404);
  const total = accuracyRows[0]?.total ?? 0;
  const correct = Number(accuracyRows[0]?.correct ?? 0);
  return {
    due_today: dueRows[0]?.value ?? 0,
    studied_today: studiedRows[0]?.value ?? 0,
    mastered_total: masteredRows[0]?.value ?? 0,
    streak: userRows[0].streak,
    accuracy_30d: total ? Math.round((correct / total) * 1_000) / 10 : 0,
  };
}

function postgresErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && typeof Reflect.get(error, "code") === "string"
    ? (Reflect.get(error, "code") as string)
    : undefined;
}
