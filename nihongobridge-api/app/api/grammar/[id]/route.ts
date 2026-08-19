import type { NextRequest } from "next/server";

import { getGrammarDetail } from "@/lib/grammar";
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
 * /api/grammar/{id}:
 *   get:
 *     summary: Get one grammar pattern with all examples and related patterns
 *     tags: [Grammar]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Grammar detail }
 *       '404': { description: Pattern not found }
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
      cacheKey("grammar:detail", parsed.data),
      86_400,
      () => getGrammarDetail(parsed.data),
      (value) => value !== null,
    );
    if (!cached.value) {
      return apiError(404, "Grammar pattern not found", undefined, {
        ...rateHeaders,
        "X-Cache": cached.status,
      });
    }
    return apiSuccess(cached.value, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "X-Cache": cached.status },
    });
  } catch (error) {
    console.error("Grammar detail failed", error);
    return apiError(500, "Grammar lookup failed", undefined, rateHeaders);
  }
}
