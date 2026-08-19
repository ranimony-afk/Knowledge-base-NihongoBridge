import type { NextRequest } from "next/server";

import { getDictionaryDetail } from "@/lib/dictionary";
import { cacheKey, withCache } from "@/middleware/cache";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { uuidParameterSchema } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/**
 * @openapi
 * /api/dictionary/{id}:
 *   get:
 *     summary: Get one dictionary entry with linked content
 *     tags: [Dictionary]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Dictionary entry detail }
 *       '404': { description: Entry not found }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  const parsed = uuidParameterSchema.safeParse(params.id);
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  try {
    const cached = await withCache(
      cacheKey("dict:detail", parsed.data),
      86_400,
      () => getDictionaryDetail(parsed.data),
      (value) => value !== null,
    );
    if (!cached.value) {
      return apiError(404, "Dictionary entry not found", undefined, {
        ...rateHeaders,
        "X-Cache": cached.status,
      });
    }
    return apiSuccess(cached.value, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "X-Cache": cached.status },
    });
  } catch (error) {
    console.error("Dictionary detail failed", error);
    return apiError(500, "Dictionary lookup failed", undefined, rateHeaders);
  }
}
