import {
  practiceTests,
  srsCards,
  srsReviewLogs,
  testSessions,
  userBookmarks,
  users,
} from "@nihongobridge/knowledge";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  type SQL,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  contentItemExists,
  contentKey,
  hydrateContentItems,
  type ContentItemType,
} from "@/lib/content";
import { getDatabase } from "@/lib/db";

export class UserApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function getUserDashboard(userId: string) {
  const db = getDatabase();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [userRows, dueRows, bookmarkRows, recentScores, reviewEvents, testEvents] =
    await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db
        .select({ value: count() })
        .from(srsCards)
        .where(and(eq(srsCards.userId, userId), lte(srsCards.nextReviewAt, now))),
      db
        .select({ value: count() })
        .from(userBookmarks)
        .where(eq(userBookmarks.userId, userId)),
      db
        .select({
          sessionId: testSessions.id,
          title: practiceTests.title,
          level: practiceTests.level,
          score: testSessions.scoreTotal,
          passed: testSessions.passed,
          completedAt: testSessions.completedAt,
        })
        .from(testSessions)
        .innerJoin(practiceTests, eq(testSessions.testId, practiceTests.id))
        .where(and(eq(testSessions.userId, userId), gte(testSessions.completedAt, sevenDaysAgo)))
        .orderBy(desc(testSessions.completedAt))
        .limit(5),
      db
        .select({ reviewedAt: srsReviewLogs.reviewedAt })
        .from(srsReviewLogs)
        .where(
          and(eq(srsReviewLogs.userId, userId), gte(srsReviewLogs.reviewedAt, sevenDaysAgo)),
        ),
      db
        .select({ completedAt: testSessions.completedAt })
        .from(testSessions)
        .where(
          and(eq(testSessions.userId, userId), gte(testSessions.completedAt, sevenDaysAgo)),
        ),
    ]);
  const user = userRows[0];
  if (!user) throw new UserApiError("User not found", 404);
  const recentActivity = activityDays(now, reviewEvents, testEvents);
  const dueCards = dueRows[0]?.value ?? 0;
  const scores = recentScores
    .filter((row) => row.completedAt)
    .map((row) => ({
      session_id: row.sessionId,
      title: row.title,
      level: row.level,
      score: row.score,
      passed: row.passed,
      completed_at: row.completedAt!.toISOString(),
    }));
  const scoreValues = scores
    .map((score) => score.score)
    .filter((score): score is number => score !== null);
  const averageScore = scoreValues.length
    ? scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length
    : null;

  return {
    user: {
      id: user.id,
      username: user.username,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
    },
    streak: user.streakDays,
    xp: user.xpTotal,
    level: {
      current: user.currentLevel,
      target: user.targetLevel,
    },
    due_cards_count: dueCards,
    recent_test_scores: scores,
    bookmarks_count: bookmarkRows[0]?.value ?? 0,
    recent_activity: recentActivity,
    recommended_next_study:
      dueCards > 0
        ? "review-due-srs-cards"
        : averageScore !== null && averageScore < 90
          ? "review-recent-test-mistakes"
          : `study-${user.targetLevel.toLowerCase()}-content`,
  };
}

export async function addBookmark(parameters: {
  userId: string;
  itemType: ContentItemType;
  itemId: string;
  collectionName: string;
}) {
  if (!(await contentItemExists(parameters.itemType, parameters.itemId))) {
    throw new UserApiError("Referenced content item does not exist", 404);
  }
  const db = getDatabase();
  const [existing] = await db
    .select()
    .from(userBookmarks)
    .where(
      and(
        eq(userBookmarks.userId, parameters.userId),
        eq(userBookmarks.itemType, parameters.itemType),
        eq(userBookmarks.itemId, parameters.itemId),
        eq(userBookmarks.collectionName, parameters.collectionName),
      ),
    )
    .limit(1);
  if (existing) return { bookmark: bookmarkDto(existing), created: false };
  try {
    const [bookmark] = await db
      .insert(userBookmarks)
      .values({
        id: randomUUID(),
        userId: parameters.userId,
        itemType: parameters.itemType,
        itemId: parameters.itemId,
        collectionName: parameters.collectionName,
      })
      .returning();
    return { bookmark: bookmarkDto(bookmark!), created: true };
  } catch (error) {
    if (postgresErrorCode(error) !== "23505") throw error;
    const [concurrent] = await db
      .select()
      .from(userBookmarks)
      .where(
        and(
          eq(userBookmarks.userId, parameters.userId),
          eq(userBookmarks.itemType, parameters.itemType),
          eq(userBookmarks.itemId, parameters.itemId),
          eq(userBookmarks.collectionName, parameters.collectionName),
        ),
      )
      .limit(1);
    if (!concurrent) throw error;
    return { bookmark: bookmarkDto(concurrent), created: false };
  }
}

export async function deleteBookmark(
  userId: string,
  bookmarkId: string,
): Promise<{ id: string }> {
  const [deleted] = await getDatabase()
    .delete(userBookmarks)
    .where(and(eq(userBookmarks.id, bookmarkId), eq(userBookmarks.userId, userId)))
    .returning({ id: userBookmarks.id });
  if (!deleted) throw new UserApiError("Bookmark not found", 404);
  return deleted;
}

export async function listBookmarks(parameters: {
  userId: string;
  itemType?: ContentItemType | undefined;
  collectionName?: string | undefined;
  page: number;
  limit: number;
}) {
  const filters: SQL[] = [eq(userBookmarks.userId, parameters.userId)];
  if (parameters.itemType) filters.push(eq(userBookmarks.itemType, parameters.itemType));
  if (parameters.collectionName) {
    filters.push(eq(userBookmarks.collectionName, parameters.collectionName));
  }
  const where = and(...filters);
  const db = getDatabase();
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(userBookmarks)
      .where(where)
      .orderBy(asc(userBookmarks.collectionName), desc(userBookmarks.createdAt))
      .limit(parameters.limit)
      .offset((parameters.page - 1) * parameters.limit),
    db.select({ value: count() }).from(userBookmarks).where(where),
  ]);
  const hydrated = await hydrateContentItems(
    rows.map((row) => ({ itemType: row.itemType, itemId: row.itemId })),
  );
  return {
    items: rows.map((row) => ({
      ...bookmarkDto(row),
      item: hydrated.get(contentKey(row.itemType, row.itemId)) ?? null,
    })),
    total: totals[0]?.value ?? 0,
  };
}

function bookmarkDto(row: typeof userBookmarks.$inferSelect) {
  return {
    id: row.id,
    user_id: row.userId,
    item_type: row.itemType,
    item_id: row.itemId,
    collection_name: row.collectionName,
    created_at: row.createdAt.toISOString(),
  };
}

function activityDays(
  now: Date,
  reviews: Array<{ reviewedAt: Date }>,
  tests: Array<{ completedAt: Date | null }>,
) {
  const days = new Map<
    string,
    { date: string; srs_reviews: number; tests_completed: number }
  >();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    days.set(key, { date: key, srs_reviews: 0, tests_completed: 0 });
  }
  for (const event of reviews) {
    const key = event.reviewedAt.toISOString().slice(0, 10);
    const day = days.get(key);
    if (day) day.srs_reviews += 1;
  }
  for (const event of tests) {
    if (!event.completedAt) continue;
    const key = event.completedAt.toISOString().slice(0, 10);
    const day = days.get(key);
    if (day) day.tests_completed += 1;
  }
  return [...days.values()];
}

function postgresErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && typeof Reflect.get(error, "code") === "string"
    ? (Reflect.get(error, "code") as string)
    : undefined;
}
