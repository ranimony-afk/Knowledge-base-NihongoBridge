import type { NextRequest } from "next/server";

import { getQuestionAudio } from "@/lib/storage";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import { apiError, zodErrorMessage } from "@/utils/response";
import { testApiError } from "@/utils/testResponse";
import { testIdSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { questionId: string };
}

/**
 * @openapi
 * /api/listening/{questionId}/audio:
 *   get:
 *     summary: Stream listening-question audio with byte range support
 *     tags: [Listening]
 *     parameters:
 *       - { in: path, name: questionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: header, name: Range, schema: { type: string, example: 'bytes=0-1023' } }
 *     responses:
 *       '200': { description: Complete MP3 stream }
 *       '206': { description: Partial MP3 stream }
 *       '404': { description: Audio not found }
 *       '416': { description: Invalid byte range }
 *       '429': { description: Rate limit exceeded }
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const rate = await rateLimit(request);
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

    const questionId = testIdSchema.safeParse(params.questionId);
    if (!questionId.success) {
      return apiError(400, zodErrorMessage(questionId.error.issues), undefined, rateHeaders);
    }
    const range = request.headers.get("range") ?? undefined;
    if (range && !validRange(range)) {
      return apiError(416, "Only one valid byte range is supported", undefined, {
        ...rateHeaders,
        "Content-Range": "bytes */*",
      });
    }
    const audio = await getQuestionAudio(questionId.data, range);
    if (!audio) return apiError(404, "Listening audio not found", undefined, rateHeaders);
    return new Response(audio.body, {
      status: audio.status,
      headers: { ...audio.headers, ...rateHeaders },
    });
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}

function validRange(value: string): boolean {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return false;
  if (match[1] && match[2] && Number(match[1]) > Number(match[2])) return false;
  return true;
}
