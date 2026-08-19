import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/lib/auth";
import { getUserTestAnalytics } from "@/lib/testQueries";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { testApiError } from "@/utils/testResponse";
import { userIdSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { userId: string };
}

/**
 * @openapi
 * /api/tests/analytics/{userId}:
 *   get:
 *     summary: Return accuracy, streak, weak question types, and study recommendation
 *     tags: [Tests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: User test analytics }
 *       '403': { description: User mismatch }
 *       '404': { description: User not found }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

    const parsed = userIdSchema.safeParse(params.userId);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    assertUserAccess(authenticated, parsed.data);
    const analytics = await getUserTestAnalytics(parsed.data);
    return apiSuccess(analytics, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
