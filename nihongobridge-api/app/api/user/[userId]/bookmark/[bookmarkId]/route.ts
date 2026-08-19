import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/middleware/auth";
import { deleteBookmark } from "@/lib/user";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { contentApiError } from "@/utils/contentResponse";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { userIdSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { userId: string; bookmarkId: string };
}

/**
 * @openapi
 * /api/user/{userId}/bookmark/{bookmarkId}:
 *   delete:
 *     summary: Delete one user-owned bookmark
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: bookmarkId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Deleted bookmark ID }
 *       '404': { description: Bookmark not found }
 *       '429': { description: Rate limit exceeded }
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
    const userId = userIdSchema.safeParse(params.userId);
    const bookmarkId = userIdSchema.safeParse(params.bookmarkId);
    if (!userId.success) {
      return apiError(400, zodErrorMessage(userId.error.issues), undefined, rateHeaders);
    }
    if (!bookmarkId.success) {
      return apiError(400, zodErrorMessage(bookmarkId.error.issues), undefined, rateHeaders);
    }
    assertUserAccess(authenticated, userId.data);
    const deleted = await deleteBookmark(userId.data, bookmarkId.data);
    return apiSuccess(deleted, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return contentApiError(error, rateHeaders);
  }
}
