import type { NextRequest } from "next/server";

import { AnthropicError, streamTutorCompletion } from "@/lib/anthropic";
import { authenticateRequest, AuthenticationError } from "@/lib/auth";
import { explanationCacheKey } from "@/lib/cache-key";
import { buildTutorSystemPrompt } from "@/lib/prompts";
import {
  getCachedExplanation,
  getTutorKnowledgeContext,
  saveExplanation,
} from "@/lib/repository";
import { consumeTutorQuota, quotaHeaders } from "@/lib/rate-limit";
import { tutorChatRequestSchema } from "@/lib/validation";
import { apiError, zodErrorMessage } from "@/utils/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function event(name: string, data: Record<string, unknown>, total = 0): Uint8Array {
  return encoder.encode(
    `event: ${name}\ndata: ${JSON.stringify({
      data,
      meta: { page: 1, limit: 1, total },
    })}\n\n`,
  );
}

function streamHeaders(rateHeaders: Record<string, string>): HeadersInit {
  return {
    ...rateHeaders,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticateRequest(request);
    const quota = await consumeTutorQuota(user);
    const rateHeaders = quotaHeaders(quota);
    if (!quota.allowed) {
      return apiError(429, "Free accounts are limited to 20 tutor messages per hour", undefined, rateHeaders);
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return apiError(400, "Request body must be valid JSON", undefined, rateHeaders);
    }
    const parsed = tutorChatRequestSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }

    const input = parsed.data;
    const knowledge = await getTutorKnowledgeContext(
      input.context.current_topic,
      input.context.recent_mistakes,
    );
    const system = buildTutorSystemPrompt(input.context, knowledge);
    const cacheKey = explanationCacheKey("tutor", {
      prompt_version: process.env.AI_PROMPT_VERSION ?? "hana-v1",
      user_id: user.id,
      message: input.message,
      context: input.context,
      conversation_history: input.conversation_history,
      knowledge,
    });
    const cached = await getCachedExplanation(cacheKey, "tutor_chat", user.id);
    const conversationId = crypto.randomUUID();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(event("meta", {
            conversation_id: conversationId,
            cached: Boolean(cached?.responseText),
          }));

          if (cached?.responseText) {
            for (const character of cached.responseText) {
              if (request.signal.aborted) break;
              controller.enqueue(event("token", { text: character }));
            }
            if (!request.signal.aborted) {
              controller.enqueue(event("done", {
                message: cached.responseText,
                model: cached.model,
                cached: true,
                tools_used: 0,
              }, 1));
            }
            controller.close();
            return;
          }

          const iterator = streamTutorCompletion({
            system,
            history: input.conversation_history,
            message: input.message,
            signal: request.signal,
          });
          let completion;
          while (true) {
            const next = await iterator.next();
            if (next.done) {
              completion = next.value;
              break;
            }
            controller.enqueue(event("token", { text: next.value }));
          }

          let persisted = true;
          try {
            await saveExplanation({
              kind: "tutor_chat",
              cacheKey,
              userId: user.id,
              language: input.context.language_preference,
              userLevel: input.context.current_level,
              requestContext: {
                message: input.message,
                context: input.context,
                conversation_history: input.conversation_history,
                knowledge,
              },
              response: {
                text: completion.text,
                tools_used: completion.toolsUsed,
              },
              responseText: completion.text,
              model: completion.model,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
            });
          } catch (error) {
            persisted = false;
            console.error("Could not persist tutor explanation", error);
          }

          controller.enqueue(event("done", {
            message: completion.text,
            model: completion.model,
            cached: false,
            persisted,
            tools_used: completion.toolsUsed,
          }, 1));
          controller.close();
        } catch (error) {
          if (!request.signal.aborted) {
            const message = error instanceof AnthropicError
              ? error.message
              : "Hana-sensei could not complete this response";
            controller.enqueue(encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                data: {},
                meta: { page: 1, limit: 1, total: 0 },
                error: message,
              })}\n\n`,
            ));
          }
          controller.close();
        }
      },
    });

    return new Response(stream, { status: 200, headers: streamHeaders(rateHeaders) });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError(error.status, error.message);
    if (error instanceof AnthropicError) return apiError(error.status, error.message);
    console.error("Tutor chat failed before streaming", error);
    return apiError(500, "AI tutor request failed");
  }
}
