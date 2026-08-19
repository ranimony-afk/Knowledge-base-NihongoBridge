import type { NextRequest } from "next/server";

import { getKanjiQuiz } from "@/lib/kanji";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import {
  kanjiCharacterSchema,
  kanjiQuizSchema,
  searchParamsObject,
} from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { character: string };
}

/**
 * @openapi
 * /api/kanji/{character}/quiz:
 *   get:
 *     summary: Get a kanji quiz prompt with selected answer fields hidden
 *     tags: [Kanji]
 *     parameters:
 *       - { in: path, name: character, required: true, schema: { type: string } }
 *       - { in: query, name: quiz_type, schema: { type: string, enum: [reading, meaning, all], default: all } }
 *     responses:
 *       '200': { description: Kanji quiz prompt }
 *       '404': { description: Kanji not found }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const character = kanjiCharacterSchema.safeParse(params.character);
  const query = kanjiQuizSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!character.success) {
    return apiError(400, zodErrorMessage(character.error.issues), undefined, rateHeaders);
  }
  if (!query.success) {
    return apiError(400, zodErrorMessage(query.error.issues), undefined, rateHeaders);
  }
  try {
    const cacheParameters = { character: character.data, quiz_type: query.data.quiz_type };
    const cached = await withCache(
      cacheKey("kanji:quiz", cacheParameters),
      86_400,
      () => getKanjiQuiz(character.data, query.data.quiz_type),
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
    console.error("Kanji quiz lookup failed", error);
    return apiError(500, "Kanji quiz lookup failed", undefined, rateHeaders);
  }
}
