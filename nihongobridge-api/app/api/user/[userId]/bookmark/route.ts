import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/middleware/auth";
import { addBookmark } from "@/lib/user";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { bookmarkBodySchema } from "@/utils/contentValidation";
import { contentApiError } from "@/utils/contentResponse";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { userIdSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { userId: string };
}

/**
 * @openapi
 * /api/user/{userId}/bookmark:
 *   post:
 *     summary: Add a content bookmark idempotently
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [item_type, item_id]
 *             properties:
 *               item_type: { type: string, enum: [word, kanji, grammar, sentence] }
 *               item_id: { type: string, format: uuid }
 *               collection_name: { type: string, default: Default }
 *     responses:
 *       '200': { description: Existing bookmark }
 *       '201': { description: Created bookmark }
 *       '404': { description: Content item not found }
 *       '429': { description: Rate limit exceeded }
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
    const userId = userIdSchema.safeParse(params.userId);
    if (!userId.success) {
      return apiError(400, zodErrorMessage(userId.error.issues), undefined, rateHeaders);
    }
    assertUserAccess(authenticated, userId.data);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Request body must be valid JSON", undefined, rateHeaders);
    }
    const parsed = bookmarkBodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    const result = await addBookmark({
      userId: userId.data,
      itemType: parsed.data.item_type,
      itemId: parsed.data.item_id,
      collectionName: parsed.data.collection_name,
    });
    return apiSuccess(result.bookmark, { page: 1, limit: 1, total: 1 }, {
      status: result.created ? 201 : 200,
      headers: { ...rateHeaders, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return contentApiError(error, rateHeaders);
  }
}
