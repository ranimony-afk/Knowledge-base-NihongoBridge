import {
  apiRequest,
  completeTest,
  isDemo,
  loadTestSession,
} from "@/lib/api-client";
import { demoResultPageData, demoReviewData } from "@/lib/demo-results";
import type { ApiEnvelope } from "@/types/test";
import type {
  ResultPageData,
  TestReviewData,
} from "@/types/results";

export async function loadResultPage(sessionId: string): Promise<ResultPageData> {
  if (isDemo(sessionId)) {
    await delay();
    return demoResultPageData();
  }
  const result = await completeTest(sessionId);
  const [review, session] = await Promise.all([
    loadTestReview(sessionId),
    loadTestSession(sessionId).catch(() => null),
  ]);
  const inferredLevel = review.questions[0]?.jlpt_level;
  const level = session?.status.level ??
    (inferredLevel === "N1" || inferredLevel === "N2" || inferredLevel === "N3" ||
    inferredLevel === "N4" || inferredLevel === "N5" ? inferredLevel : "N5");
  return {
    result,
    review,
    level,
    testType: session?.status.test_type ?? (review.sections.length > 1 ? "full_mock" : "section_drill"),
    totalTimeSeconds: review.sections.reduce(
      (sum, section) => sum + section.time_minutes * 60,
      0,
    ),
  };
}

export async function loadTestReview(sessionId: string): Promise<TestReviewData> {
  if (isDemo(sessionId)) {
    await delay();
    return demoReviewData();
  }
  const envelope = await apiRequest<ApiEnvelope<TestReviewData>>(
    `/api/tests/session/${encodeURIComponent(sessionId)}/review`,
    { method: "GET" },
  );
  return envelope.data;
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 220));
}
