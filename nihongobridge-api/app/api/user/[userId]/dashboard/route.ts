import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/middleware/auth";
import { getUserDashboard } from "@/lib/user";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
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
 * /api/user/{userId}/dashboard:
 *   get:
 *     summary: Return dashboard totals, activity, tests, and study recommendation
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: User dashboard }
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
    const dashboard = await getUserDashboard(parsed.data);
    return apiSuccess(dashboard, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return contentApiError(error, rateHeaders);
  }
}
