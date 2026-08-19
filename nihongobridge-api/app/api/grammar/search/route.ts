import type { NextRequest } from "next/server";

import { searchGrammar } from "@/lib/grammar";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { grammarSearchSchema } from "@/utils/contentValidation";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/grammar/search:
 *   get:
 *     summary: Search grammar patterns and English meanings
 *     tags: [Grammar]
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string } }
 *       - { in: query, name: level, schema: { type: string, enum: [N5, N4, N3, N2, N1] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Paginated grammar patterns }
 *       '400': { description: Invalid query }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);
  const parsed = grammarSearchSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  try {
    const cached = await withCache(cacheKey("grammar:search", parsed.data), 3_600, () =>
      searchGrammar({
        q: parsed.data.q,
        level: parsed.data.level,
        page: parsed.data.page,
        limit: parsed.data.limit,
      }),
    );
    return apiSuccess(
      cached.value.items,
      { page: parsed.data.page, limit: parsed.data.limit, total: cached.value.total },
      { headers: { ...rateHeaders, "X-Cache": cached.status } },
    );
  } catch (error) {
    console.error("Grammar search failed", error);
    return apiError(500, "Grammar search failed", undefined, rateHeaders);
  }
}
