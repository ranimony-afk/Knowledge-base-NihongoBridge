import type { NextRequest } from "next/server";

import { searchKanji } from "@/lib/kanji";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { kanjiSearchSchema, searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/kanji/search:
 *   get:
 *     summary: Search kanji by meaning, reading, radical, grade, strokes, or JLPT level
 *     tags: [Kanji]
 *     parameters:
 *       - { in: query, name: q, schema: { type: string } }
 *       - { in: query, name: level, schema: { type: string, enum: [N5, N4, N3, N2, N1] } }
 *       - { in: query, name: grade, schema: { type: integer, minimum: 1, maximum: 9 } }
 *       - { in: query, name: stroke_min, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: stroke_max, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: radical, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200': { description: Paginated kanji }
 *       '400': { description: Invalid filters }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const parsed = kanjiSearchSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  const parameters = {
    q: parsed.data.q,
    level: parsed.data.level,
    grade: parsed.data.grade,
    strokeMin: parsed.data.stroke_min,
    strokeMax: parsed.data.stroke_max,
    radical: parsed.data.radical,
    page: parsed.data.page,
    limit: parsed.data.limit,
  };
  try {
    const cached = await withCache(cacheKey("kanji:search", parameters), 3_600, () =>
      searchKanji(parameters),
    );
    return apiSuccess(
      cached.value.items,
      {
        page: parsed.data.page,
        limit: parsed.data.limit,
        total: cached.value.total,
      },
      { headers: { ...rateHeaders, "X-Cache": cached.status } },
    );
  } catch (error) {
    console.error("Kanji search failed", error);
    return apiError(500, "Kanji search failed", undefined, rateHeaders);
  }
}
