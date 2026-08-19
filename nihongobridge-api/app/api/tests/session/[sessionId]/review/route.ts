import type { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth";
import { getTestReview } from "@/lib/testQueries";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { testApiError } from "@/utils/testResponse";
import { sessionIdSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { sessionId: string };
}

/**
 * @openapi
 * /api/tests/session/{sessionId}/review:
 *   get:
 *     summary: Review completed questions with answers, explanations, and linked content
 *     tags: [Tests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: sessionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Full completed-test review }
 *       '403': { description: Session belongs to another user }
 *       '409': { description: Test is not complete }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

    const parsed = sessionIdSchema.safeParse(params.sessionId);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    const review = await getTestReview(parsed.data, authenticated.id);
    return apiSuccess(
      review,
      { page: 1, limit: review.questions.length, total: review.questions.length },
      { headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
