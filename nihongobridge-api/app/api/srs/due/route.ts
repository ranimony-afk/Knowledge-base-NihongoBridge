import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/middleware/auth";
import { getDueCards } from "@/lib/srs";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { srsDueSchema } from "@/utils/contentValidation";
import { contentApiError } from "@/utils/contentResponse";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/srs/due:
 *   get:
 *     summary: Return due SRS cards with complete content data
 *     tags: [SRS]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: user_id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: deck_id, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Overdue-first SRS cards }
 *       '403': { description: User mismatch }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
    const parsed = srsDueSchema.safeParse(searchParamsObject(request.nextUrl));
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    assertUserAccess(authenticated, parsed.data.user_id);
    const result = await getDueCards({
      userId: parsed.data.user_id,
      limit: parsed.data.limit,
      deckId: parsed.data.deck_id,
    });
    return apiSuccess(
      result.cards,
      { page: 1, limit: parsed.data.limit, total: result.total },
      { headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return contentApiError(error, rateHeaders);
  }
}
