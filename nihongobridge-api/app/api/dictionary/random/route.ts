import type { NextRequest } from "next/server";

import { randomDictionaryEntries } from "@/lib/dictionary";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { randomDictionarySchema, searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/dictionary/random:
 *   get:
 *     summary: Get random active entries for flashcards or quizzes
 *     tags: [Dictionary]
 *     parameters:
 *       - { in: query, name: level, schema: { type: string, enum: [N5, N4, N3, N2, N1] } }
 *       - { in: query, name: limit, schema: { type: integer, default: 1, maximum: 50 } }
 *     responses:
 *       '200': { description: Random dictionary entries }
 *       '400': { description: Invalid query }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const parsed = randomDictionarySchema.safeParse(searchParamsObject(request.nextUrl));
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  try {
    const result = await randomDictionaryEntries(parsed.data.level, parsed.data.limit);
    return apiSuccess(
      result.items,
      { page: 1, limit: parsed.data.limit, total: result.total },
      { headers: { ...rateHeaders, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Random dictionary lookup failed", error);
    return apiError(500, "Random dictionary lookup failed", undefined, rateHeaders);
  }
}
