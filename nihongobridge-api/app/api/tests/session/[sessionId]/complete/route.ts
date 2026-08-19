import type { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth";
import { completeTestSession } from "@/lib/testEngine";
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
 * /api/tests/session/{sessionId}/complete:
 *   post:
 *     summary: Finalize a test, calculate scores, XP, streak, and progress
 *     tags: [Tests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: sessionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Scores, pass status, accuracy, XP, and review URL }
 *       '403': { description: Session belongs to another user }
 *       '409': { description: Completion is already in progress }
 *       '410': { description: Redis session state expired before completion }
 *       '429': { description: Rate limit exceeded }
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
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
    const result = await completeTestSession(parsed.data, authenticated.id);
    return apiSuccess(result, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
