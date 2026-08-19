import type { NextRequest } from "next/server";

import { assertUserAccess, authenticateRequest } from "@/lib/auth";
import { startTestSession } from "@/lib/testEngine";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import type { RequestedTestType } from "@/types/test";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { testApiError } from "@/utils/testResponse";
import { startTestSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/tests/start:
 *   post:
 *     summary: Start a timed JLPT-style practice test
 *     tags: [Tests]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [level, test_type, user_id]
 *             properties:
 *               level: { type: string, enum: [N5, N4, N3, N2, N1] }
 *               test_type: { type: string, enum: [full_mock, section_drill] }
 *               section: { type: string, enum: [vocabulary, grammar, reading, listening] }
 *               user_id: { type: string, format: uuid }
 *     responses:
 *       '200': { description: Session ID, sections, first question, and timer }
 *       '401': { description: Authentication required }
 *       '409': { description: Test pool is unavailable }
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
    const parsed = startTestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    assertUserAccess(authenticated, parsed.data.user_id);
    const testType: RequestedTestType = ["full_mock", "mock_full"].includes(
      parsed.data.test_type,
    )
      ? "full_mock"
      : "section_drill";
    const result = await startTestSession({
      level: parsed.data.level,
      testType,
      section: parsed.data.section,
      userId: parsed.data.user_id,
    });
    return apiSuccess(result, { page: 1, limit: 1, total: 1 }, { headers: rateHeaders });
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
