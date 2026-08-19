import type { NextRequest } from "next/server";

import { globalSearch } from "@/lib/globalSearch";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { globalSearchSchema } from "@/utils/contentValidation";
import { searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Search words, kanji, grammar, and sentences in one request
 *     tags: [Search]
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string } }
 *       - { in: query, name: types, schema: { type: string, example: 'word,kanji,grammar,sentence' } }
 *       - { in: query, name: level, schema: { type: string, enum: [N5, N4, N3, N2, N1] } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 50 } }
 *     responses:
 *       '200': { description: Results grouped by content type }
 *       '400': { description: Invalid query }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
  const parsed = globalSearchSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  try {
    const cached = await withCache(cacheKey("global:search", parsed.data), 3_600, () =>
      globalSearch(parsed.data),
    );
    const result = cached.value;
    const total = Object.values(result.totals).reduce((sum, value) => sum + value, 0);
    return apiSuccess(
      {
        words: result.words,
        kanji: result.kanji,
        grammar: result.grammar,
        sentences: result.sentences,
      },
      { page: 1, limit: parsed.data.limit, total },
      {
        headers: {
          ...rateHeaders,
          "X-Cache": cached.status,
          "X-Search-Engine": result.engine,
        },
      },
    );
  } catch (error) {
    console.error("Global search failed", error);
    return apiError(500, "Global search failed", undefined, rateHeaders);
  }
}
