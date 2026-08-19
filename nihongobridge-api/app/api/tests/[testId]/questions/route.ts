import type { NextRequest } from "next/server";

import { assertAdmin, authenticateRequest } from "@/lib/auth";
import { getAdminTestQuestions } from "@/lib/testQueries";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { searchParamsObject } from "@/utils/validation";
import { testApiError } from "@/utils/testResponse";
import { testIdSchema, testQuestionsSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { testId: string };
}

/**
 * @openapi
 * /api/tests/{testId}/questions:
 *   get:
 *     summary: List test questions for admin preview
 *     tags: [Tests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: testId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: section, schema: { type: string, enum: [vocabulary, grammar, reading, listening] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Full question records for preview }
 *       '403': { description: Admin access required }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    assertAdmin(authenticated);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

    const testId = testIdSchema.safeParse(params.testId);
    const query = testQuestionsSchema.safeParse(searchParamsObject(request.nextUrl));
    if (!testId.success) {
      return apiError(400, zodErrorMessage(testId.error.issues), undefined, rateHeaders);
    }
    if (!query.success) {
      return apiError(400, zodErrorMessage(query.error.issues), undefined, rateHeaders);
    }
    const result = await getAdminTestQuestions({
      testId: testId.data,
      section: query.data.section,
      page: query.data.page,
      limit: query.data.limit,
    });
    return apiSuccess(
      result.items,
      { page: query.data.page, limit: query.data.limit, total: result.total },
      { headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
