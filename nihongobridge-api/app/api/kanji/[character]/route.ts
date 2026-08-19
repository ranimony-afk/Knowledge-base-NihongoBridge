import type { NextRequest } from "next/server";

import { getKanjiDetail } from "@/lib/kanji";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { kanjiCharacterSchema } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { character: string };
}

/**
 * @openapi
 * /api/kanji/{character}:
 *   get:
 *     summary: Get one kanji with example words and similar kanji
 *     tags: [Kanji]
 *     parameters:
 *       - { in: path, name: character, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Kanji detail }
 *       '404': { description: Kanji not found }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const parsed = kanjiCharacterSchema.safeParse(params.character);
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  try {
    const cached = await withCache(
      cacheKey("kanji:detail", parsed.data),
      86_400,
      () => getKanjiDetail(parsed.data),
      (value) => value !== null,
    );
    if (!cached.value) {
      return apiError(404, "Kanji not found", undefined, {
        ...rateHeaders,
        "X-Cache": cached.status,
      });
    }
    return apiSuccess(
      cached.value,
      { page: 1, limit: 1, total: 1 },
      { headers: { ...rateHeaders, "X-Cache": cached.status } },
    );
  } catch (error) {
    console.error("Kanji detail failed", error);
    return apiError(500, "Kanji lookup failed", undefined, rateHeaders);
  }
}
