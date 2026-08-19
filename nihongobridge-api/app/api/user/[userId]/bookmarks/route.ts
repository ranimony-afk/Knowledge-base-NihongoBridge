import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/middleware/auth";
import { listBookmarks } from "@/lib/user";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { bookmarkListSchema } from "@/utils/contentValidation";
import { contentApiError } from "@/utils/contentResponse";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { userIdSchema } from "@/utils/testValidation";
import { searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { userId: string };
}

/**
 * @openapi
 * /api/user/{userId}/bookmarks:
 *   get:
 *     summary: List user bookmarks with hydrated content
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: item_type, schema: { type: string, enum: [word, kanji, grammar, sentence] } }
 *       - { in: query, name: collection_name, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Paginated bookmarks }
 *       '403': { description: User mismatch }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
    const userId = userIdSchema.safeParse(params.userId);
    const query = bookmarkListSchema.safeParse(searchParamsObject(request.nextUrl));
    if (!userId.success) {
      return apiError(400, zodErrorMessage(userId.error.issues), undefined, rateHeaders);
    }
    if (!query.success) {
      return apiError(400, zodErrorMessage(query.error.issues), undefined, rateHeaders);
    }
    assertUserAccess(authenticated, userId.data);
    const result = await listBookmarks({
      userId: userId.data,
      itemType: query.data.item_type,
      collectionName: query.data.collection_name,
      page: query.data.page,
      limit: query.data.limit,
    });
    return apiSuccess(
      result.items,
      { page: query.data.page, limit: query.data.limit, total: result.total },
      { headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return contentApiError(error, rateHeaders);
  }
}
