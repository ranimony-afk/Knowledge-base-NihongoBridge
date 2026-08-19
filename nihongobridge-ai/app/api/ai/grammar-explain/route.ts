import type { NextRequest } from "next/server";

import { AnthropicError, generateStructured } from "@/lib/anthropic";
import { authenticateRequest, AuthenticationError } from "@/lib/auth";
import { explanationCacheKey } from "@/lib/cache-key";
import { grammarExplanationPrompt } from "@/lib/prompts";
import {
  getCachedExplanation,
  getGrammarPattern,
  saveExplanation,
  type PromptGrammarContext,
} from "@/lib/repository";
import {
  grammarExplanationSchema,
  grammarExplainRequestSchema,
} from "@/lib/validation";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    await authenticateRequest(request);
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return apiError(400, "Request body must be valid JSON");
    }
    const parsed = grammarExplainRequestSchema.safeParse(json);
    if (!parsed.success) return apiError(400, zodErrorMessage(parsed.error.issues));

    const grammar = await getGrammarPattern(parsed.data.pattern_id);
    if (!grammar) return apiError(404, "Grammar pattern not found");
    const promptGrammar: PromptGrammarContext = {
      id: grammar.id,
      pattern: grammar.pattern,
      meaning: grammar.meaning,
      formation: grammar.formation,
      examples: grammar.examples,
      common_mistakes: grammar.commonMistakes,
      jlpt_level: grammar.jlptLevel,
      source: grammar.source,
    };
    const cacheKey = explanationCacheKey("grammar", {
      prompt_version: process.env.AI_PROMPT_VERSION ?? "hana-v1",
      grammar: promptGrammar,
      user_level: parsed.data.user_level,
      example_sentence: parsed.data.example_sentence ?? null,
    });
    const cached = await getCachedExplanation(cacheKey, "grammar");
    if (cached) {
      const valid = grammarExplanationSchema.safeParse(cached.response);
      if (valid.success) return apiSuccess({ ...valid.data, cached: true });
    }

    const prompt = grammarExplanationPrompt(
      promptGrammar,
      parsed.data.user_level,
      parsed.data.example_sentence,
    );
    const generated = await generateStructured({
      ...prompt,
      schema: grammarExplanationSchema,
      maxTokens: 3_000,
      signal: request.signal,
    });
    await saveExplanation({
      kind: "grammar",
      cacheKey,
      grammarPatternId: grammar.id,
      language: "en",
      userLevel: parsed.data.user_level,
      requestContext: {
        pattern_id: grammar.id,
        example_sentence: parsed.data.example_sentence ?? null,
      },
      response: generated.data,
      model: generated.model,
    });
    return apiSuccess({ ...generated.data, cached: false });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError(error.status, error.message);
    if (error instanceof AnthropicError) return apiError(error.status, error.message);
    console.error("Grammar explanation failed", error);
    return apiError(500, "Grammar explanation failed");
  }
}
