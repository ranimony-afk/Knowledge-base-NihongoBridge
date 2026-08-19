import type { NextRequest } from "next/server";

import { autocompleteDictionary } from "@/lib/dictionary";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { autocompleteSchema, searchParamsObject } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/dictionary/autocomplete:
 *   get:
 *     summary: Return fast word and kana prefix suggestions
 *     tags: [Dictionary]
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string, minLength: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 20 } }
 *     responses:
 *       '200': { description: Autocomplete suggestions }
 *       '400': { description: Invalid query }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const parsed = autocompleteSchema.safeParse(searchParamsObject(request.nextUrl));
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  try {
    const cached = await withCache(cacheKey("dict:autocomplete", parsed.data), 1_800, () =>
      autocompleteDictionary(parsed.data.q, parsed.data.limit),
    );
    return apiSuccess(
      cached.value,
      { page: 1, limit: parsed.data.limit, total: cached.value.length },
      { headers: { ...rateHeaders, "X-Cache": cached.status } },
    );
  } catch (error) {
    console.error("Dictionary autocomplete failed", error);
    return apiError(500, "Autocomplete failed", undefined, rateHeaders);
  }
}
