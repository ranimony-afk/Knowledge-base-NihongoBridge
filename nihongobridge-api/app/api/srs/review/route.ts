import type { NextRequest } from "next/server";

import { authenticateRequest } from "@/middleware/auth";
import { reviewSrsCard } from "@/lib/srs";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { srsReviewSchema } from "@/utils/contentValidation";
import { contentApiError } from "@/utils/contentResponse";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/srs/review:
 *   post:
 *     summary: Apply one SM-2 confidence result to an SRS card
 *     tags: [SRS]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [card_id, confidence, time_taken_ms]
 *             properties:
 *               card_id: { type: string, format: uuid }
 *               confidence: { type: string, enum: [again, hard, good, easy] }
 *               time_taken_ms: { type: integer, minimum: 0 }
 *     responses:
 *       '200': { description: Updated interval, ease, due date, and remaining cards }
 *       '404': { description: Card does not belong to the authenticated user }
 *       '429': { description: Rate limit exceeded }
 */
export async function POST(request: NextRequest) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Request body must be valid JSON", undefined, rateHeaders);
    }
    const parsed = srsReviewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    const result = await reviewSrsCard({
      cardId: parsed.data.card_id,
      userId: authenticated.id,
      confidence: parsed.data.confidence,
      timeTakenMs: parsed.data.time_taken_ms,
    });
    return apiSuccess(result, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return contentApiError(error, rateHeaders);
  }
}
