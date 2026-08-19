import type { NextRequest } from "next/server";

import { listKanjiByLevel } from "@/lib/kanji";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { jlptLevelSchema, levelListSchema, searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { level: string };
}

/**
 * @openapi
 * /api/kanji/level/{level}:
 *   get:
 *     summary: List kanji assigned to a JLPT level
 *     tags: [Kanji]
 *     parameters:
 *       - { in: path, name: level, required: true, schema: { type: string, enum: [N5, N4, N3, N2, N1] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Paginated level kanji }
 *       '400': { description: Invalid level or pagination }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const level = jlptLevelSchema.safeParse(params.level.toUpperCase());
  const pagination = levelListSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!level.success) {
    return apiError(400, zodErrorMessage(level.error.issues), undefined, rateHeaders);
  }
  if (!pagination.success) {
    return apiError(400, zodErrorMessage(pagination.error.issues), undefined, rateHeaders);
  }
  try {
    const cached = await withCache(
      cacheKey("kanji:level", { level: level.data, ...pagination.data }),
      3_600,
      () => listKanjiByLevel(level.data, pagination.data.page, pagination.data.limit),
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
    console.error("Kanji level lookup failed", error);
    return apiError(500, "Kanji level lookup failed", undefined, rateHeaders);
  }
}
