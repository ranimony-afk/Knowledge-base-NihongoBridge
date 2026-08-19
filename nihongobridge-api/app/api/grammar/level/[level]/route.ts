import type { NextRequest } from "next/server";

import { listGrammarByLevel } from "@/lib/grammar";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { grammarListSchema } from "@/utils/contentValidation";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { jlptLevelSchema, searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { level: string };
}

/**
 * @openapi
 * /api/grammar/level/{level}:
 *   get:
 *     summary: List grammar patterns assigned to a JLPT level
 *     tags: [Grammar]
 *     parameters:
 *       - { in: path, name: level, required: true, schema: { type: string, enum: [N5, N4, N3, N2, N1] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Paginated grammar patterns }
 *       '400': { description: Invalid level }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
  const level = jlptLevelSchema.safeParse(params.level.toUpperCase());
  const pagination = grammarListSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!level.success) {
    return apiError(400, zodErrorMessage(level.error.issues), undefined, rateHeaders);
  }
  if (!pagination.success) {
    return apiError(400, zodErrorMessage(pagination.error.issues), undefined, rateHeaders);
  }
  try {
    const cached = await withCache(
      cacheKey("grammar:level", { level: level.data, ...pagination.data }),
      3_600,
      () => listGrammarByLevel(level.data, pagination.data.page, pagination.data.limit),
    );
    return apiSuccess(
      cached.value.items,
      {
        page: pagination.data.page,
        limit: pagination.data.limit,
        total: cached.value.total,
      },
      { headers: { ...rateHeaders, "X-Cache": cached.status } },
    );
  } catch (error) {
    console.error("Grammar level lookup failed", error);
    return apiError(500, "Grammar level lookup failed", undefined, rateHeaders);
  }
}
