import type { NextRequest } from "next/server";

import { generateGrammarQuiz } from "@/lib/grammar";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { uuidParameterSchema } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/**
 * @openapi
 * /api/grammar/{id}/quiz:
 *   get:
 *     summary: Generate a four-option sentence quiz for a grammar pattern
 *     tags: [Grammar]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Grammar quiz and answer }
 *       '404': { description: Grammar pattern not found }
 *       '409': { description: Not enough linked sentence data }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
  const parsed = uuidParameterSchema.safeParse(params.id);
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  try {
    const result = await generateGrammarQuiz(parsed.data);
    if (!result) return apiError(404, "Grammar pattern not found", undefined, rateHeaders);
    if (!result.quiz) {
      return apiError(409, "Not enough linked sentences to create a quiz", undefined, rateHeaders);
    }
    return apiSuccess(result, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Grammar quiz generation failed", error);
    return apiError(500, "Grammar quiz generation failed", undefined, rateHeaders);
  }
}
