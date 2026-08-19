import type { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth";
import { getSession, toSessionStatus } from "@/lib/session";
import { TestEngineError } from "@/lib/testEngine";
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
 * /api/tests/session/{sessionId}:
 *   get:
 *     summary: Get current timed-session state without answer keys
 *     tags: [Tests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: sessionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Current question, answers, and timing }
 *       '403': { description: Session belongs to another user }
 *       '404': { description: Session state not found }
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
    const session = await getSession(parsed.data);
    if (!session) throw new TestEngineError("Test session state not found", 404);
    if (session.user_id !== authenticated.id) throw new TestEngineError("Forbidden", 403);
    return apiSuccess(
      toSessionStatus(session),
      { page: 1, limit: 1, total: 1 },
      { headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
