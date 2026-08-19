import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/lib/auth";
import { getTestHistory } from "@/lib/testQueries";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { searchParamsObject } from "@/utils/validation";
import { testApiError } from "@/utils/testResponse";
import { historySchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/tests/history:
 *   get:
 *     summary: List a user's completed test sessions and score trends
 *     tags: [Tests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: user_id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: level, schema: { type: string, enum: [N5, N4, N3, N2, N1] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Paginated test history }
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

    const parsed = historySchema.safeParse(searchParamsObject(request.nextUrl));
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    assertUserAccess(authenticated, parsed.data.user_id);
    const result = await getTestHistory({
      userId: parsed.data.user_id,
      level: parsed.data.level,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    return apiSuccess(
      result.items,
      { page: parsed.data.page, limit: parsed.data.limit, total: result.total },
      { headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
