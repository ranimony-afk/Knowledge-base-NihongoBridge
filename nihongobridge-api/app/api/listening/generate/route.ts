import type { NextRequest } from "next/server";

import { assertAdmin, authenticateRequest } from "@/lib/auth";
import { generateListeningAudio } from "@/lib/tts";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { testApiError } from "@/utils/testResponse";
import { listeningGenerateSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/listening/generate:
 *   post:
 *     summary: Generate alternating-voice Japanese audio and store it in MinIO
 *     tags: [Listening]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [script]
 *             properties:
 *               script:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [text]
 *                   properties:
 *                     speaker: { type: string }
 *                     text: { type: string, maxLength: 500 }
 *               voice_config:
 *                 type: object
 *                 properties:
 *                   female_voice: { type: string, default: ja-JP-NanamiNeural }
 *                   male_voice: { type: string, default: ja-JP-KeitaNeural }
 *                   rate: { type: string, example: '+0%' }
 *                   volume: { type: string, example: '+0%' }
 *     responses:
 *       '200': { description: Generated MinIO audio URL }
 *       '403': { description: Admin access required }
 *       '429': { description: Rate limit exceeded }
 */
export async function POST(request: NextRequest) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    assertAdmin(authenticated);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Request body must be valid JSON", undefined, rateHeaders);
    }
    const parsed = listeningGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }
    const generated = await generateListeningAudio(parsed.data.script, parsed.data.voice_config);
    return apiSuccess(
      {
        audio_url: generated.audioUrl,
        object_key: generated.objectKey,
        line_count: parsed.data.script.length,
      },
      { page: 1, limit: 1, total: 1 },
      { headers: { ...rateHeaders, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
