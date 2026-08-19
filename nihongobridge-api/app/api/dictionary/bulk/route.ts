import type { NextRequest } from "next/server";

import { bulkDictionaryEntries } from "@/lib/dictionary";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { dictionaryBulkSchema } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/dictionary/bulk:
 *   post:
 *     summary: Fetch up to 100 dictionary entries by UUID
 *     tags: [Dictionary]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, maxItems: 100, items: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Entries in request order }
 *       '400': { description: Invalid body }
 *       '429': { description: Rate limit exceeded }
 */
export async function POST(request: NextRequest) {
  const rate = await rateLimit(request);
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Request body must be valid JSON", undefined, rateHeaders);
  }
  const parsed = dictionaryBulkSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
  }
  try {
    const items = await bulkDictionaryEntries(parsed.data.ids);
    return apiSuccess(
      items,
      { page: 1, limit: parsed.data.ids.length, total: items.length },
      { headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Dictionary bulk lookup failed", error);
    return apiError(500, "Bulk dictionary lookup failed", undefined, rateHeaders);
  }
}
