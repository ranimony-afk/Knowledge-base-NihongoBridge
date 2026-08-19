import {
  dictionaryEntries,
  grammarPatterns,
  kanjiEntries,
  practiceTests,
  questions,
  sentences,
} from "@nihongobridge/knowledge";
import { count, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { adminContext, requirePermission } from "@/lib/auth";
import { getAdminDb } from "@/lib/db";
import { contentReviews, etlPipelineRuns } from "@/schema/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = adminContext();
    requirePermission(context, "read");
    const db = getAdminDb();
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [
      words,
      kanji,
      grammar,
      sentenceCount,
      tests,
      questionCount,
      pending,
      recentWords,
      recentQuestions,
      pipeline,
    ] = await Promise.all([
      db.select({ value: count() }).from(dictionaryEntries),
      db.select({ value: count() }).from(kanjiEntries),
      db.select({ value: count() }).from(grammarPatterns),
      db.select({ value: count() }).from(sentences),
      db.select({ value: count() }).from(practiceTests),
      db.select({ value: count() }).from(questions),
      db
        .select({ value: count() })
        .from(contentReviews)
        .where(eq(contentReviews.status, "pending")),
      db
        .select({ value: count() })
        .from(dictionaryEntries)
        .where(gte(dictionaryEntries.createdAt, since)),
      db.select({ value: count() }).from(questions).where(gte(questions.createdAt, since)),
      db.select().from(etlPipelineRuns).orderBy(desc(etlPipelineRuns.startedAt)).limit(1),
    ]);
    return NextResponse.json({
      data: {
        counts: {
          words: words[0]?.value ?? 0,
          kanji: kanji[0]?.value ?? 0,
          grammar: grammar[0]?.value ?? 0,
          sentences: sentenceCount[0]?.value ?? 0,
          tests: tests[0]?.value ?? 0,
          questions: questionCount[0]?.value ?? 0,
        },
        recent: {
          words: recentWords[0]?.value ?? 0,
          questions: recentQuestions[0]?.value ?? 0,
        },
        pendingReviews: pending[0]?.value ?? 0,
        lastPipeline: pipeline[0] ?? null,
      },
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dashboard failed" }, { status });
  }
}
