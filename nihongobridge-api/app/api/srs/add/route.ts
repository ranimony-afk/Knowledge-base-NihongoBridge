import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/middleware/auth";
import { addSrsCard } from "@/lib/srs";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { srsAddSchema } from "@/utils/contentValidation";
import { contentApiError } from "@/utils/contentResponse";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/srs/add:
 *   post:
 *     summary: Add a unique content item to the user's SRS queue
 *     tags: [SRS]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, item_type, item_id]
 *             properties:
 *               user_id: { type: string, format: uuid }
 *               item_type: { type: string, enum: [word, kanji, grammar, sentence] }
 *               item_id: { type: string, format: uuid }
 *               deck_id: { type: string, format: uuid }
 *     responses:
 *       '200': { description: Created SRS card }
 *       '404': { description: Content item or deck not found }
 *       '409': { description: Item is already in the queue }
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
    const parsed = srsAddSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    assertUserAccess(authenticated, parsed.data.user_id);
    const card = await addSrsCard({
      userId: parsed.data.user_id,
      itemType: parsed.data.item_type,
      itemId: parsed.data.item_id,
      deckId: parsed.data.deck_id,
    });
    return apiSuccess(
      {
        id: card.id,
        user_id: card.userId,
        item_type: card.itemType,
        item_id: card.itemId,
        deck_id: card.deckId,
        next_review_at: card.nextReviewAt.toISOString(),
      },
      { page: 1, limit: 1, total: 1 },
      { status: 201, headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return contentApiError(error, rateHeaders);
  }
}
