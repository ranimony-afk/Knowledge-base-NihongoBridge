import type { NextRequest } from "next/server";

import { searchDictionary } from "@/lib/search";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { dictionarySearchSchema, searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/dictionary/search:
 *   get:
 *     summary: Search dictionary entries
 *     tags: [Dictionary]
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string } }
 *       - { in: query, name: level, schema: { type: string, enum: [N5, N4, N3, N2, N1] } }
 *       - { in: query, name: pos, schema: { type: string } }
 *       - { in: query, name: has_audio, schema: { type: boolean } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Paginated dictionary entries }
 *       '400': { description: Invalid query parameters }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const parsed = dictionarySearchSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  const parameters = parsed.data;
  try {
    const key = cacheKey("dict:search", parameters);
    const cached = await withCache(key, 3_600, () => searchDictionary(parameters));
    return apiSuccess(
      cached.value.items,
      {
        page: parameters.page,
        limit: parameters.limit,
        total: cached.value.total,
      },
      {
        headers: {
          ...rateHeaders,
          "X-Cache": cached.status,
          "X-Search-Engine": cached.value.engine,
        },
      },
    );
  } catch (error) {
    console.error("Dictionary search failed", error);
    return apiError(500, "Dictionary search failed", undefined, rateHeaders);
  }
}
