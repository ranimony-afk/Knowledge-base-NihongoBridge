import type { NextRequest } from "next/server";

import { listKanjiByRadical } from "@/lib/kanji";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import {
  radicalListSchema,
  radicalParameterSchema,
  searchParamsObject,
} from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { radical: string };
}

/**
 * @openapi
 * /api/kanji/by-radical/{radical}:
 *   get:
 *     summary: List kanji containing a radical
 *     tags: [Kanji]
 *     parameters:
 *       - { in: path, name: radical, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Paginated kanji }
 *       '400': { description: Invalid radical or pagination }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const radical = radicalParameterSchema.safeParse(params.radical);
  const pagination = radicalListSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!radical.success) {
    return apiError(400, zodErrorMessage(radical.error.issues), undefined, rateHeaders);
  }
  if (!pagination.success) {
    return apiError(400, zodErrorMessage(pagination.error.issues), undefined, rateHeaders);
  }
  try {
    const keyParameters = { radical: radical.data, ...pagination.data };
    const cached = await withCache(cacheKey("kanji:radical", keyParameters), 3_600, () =>
      listKanjiByRadical(radical.data, pagination.data.page, pagination.data.limit),
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
    console.error("Kanji radical lookup failed", error);
    return apiError(500, "Kanji radical lookup failed", undefined, rateHeaders);
  }
}
