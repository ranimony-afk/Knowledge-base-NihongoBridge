import type { NextRequest } from "next/server";

import { AnthropicError, generateStructured } from "@/lib/anthropic";
import { authenticateRequest, AuthenticationError } from "@/lib/auth";
import { explanationCacheKey } from "@/lib/cache-key";
import { translationPrompt } from "@/lib/prompts";
import { getCachedExplanation, saveExplanation } from "@/lib/repository";
import {
  translationRequestSchema,
  translationResultSchema,
} from "@/lib/validation";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function containsJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(text);
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    await authenticateRequest(request);
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return apiError(400, "Request body must be valid JSON");
    }
    const parsed = translationRequestSchema.safeParse(json);
    if (!parsed.success) return apiError(400, zodErrorMessage(parsed.error.issues));

    const sourceIsJapanese = containsJapanese(parsed.data.text);
    if (sourceIsJapanese && parsed.data.target_lang === "ja") {
      return apiError(400, "Japanese source text needs a non-Japanese target language");
    }
    if (!sourceIsJapanese && parsed.data.target_lang !== "ja") {
      return apiError(400, "Translations must be between Japanese and a supported language");
    }

    const cacheKey = explanationCacheKey("translation", {
      prompt_version: process.env.AI_PROMPT_VERSION ?? "hana-v1",
      ...parsed.data,
    });
    const cached = await getCachedExplanation(cacheKey, "translation");
    if (cached) {
      const valid = translationResultSchema.safeParse(cached.response);
      if (valid.success) return apiSuccess({ ...valid.data, cached: true });
    }

    const prompt = translationPrompt(
      parsed.data.text,
      parsed.data.target_lang,
      parsed.data.include_breakdown,
    );
    const generated = await generateStructured({
      ...prompt,
      schema: translationResultSchema,
      maxTokens: parsed.data.include_breakdown ? 4_000 : 2_000,
      signal: request.signal,
    });
    if (generated.data.target_lang !== parsed.data.target_lang) {
      throw new AnthropicError("Anthropic returned the wrong target language");
    }
    if (parsed.data.include_breakdown && generated.data.breakdown === null) {
      throw new AnthropicError("Anthropic omitted the requested translation breakdown");
    }
    const result = {
      ...generated.data,
      breakdown: parsed.data.include_breakdown ? generated.data.breakdown : null,
    };
    await saveExplanation({
      kind: "translation",
      cacheKey,
      language: parsed.data.target_lang,
      userLevel: "NONE",
      requestContext: parsed.data,
      response: result,
      model: generated.model,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
    });
    return apiSuccess({ ...result, cached: false });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError(error.status, error.message);
    if (error instanceof AnthropicError) return apiError(error.status, error.message);
    console.error("Translation failed", error);
    return apiError(500, "Translation failed");
  }
}
