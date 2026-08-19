import type { NextRequest } from "next/server";

import { AnthropicError, generateStructured } from "@/lib/anthropic";
import {
  assertQuestionAuthor,
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth";
import { questionGenerationPrompt } from "@/lib/prompts";
import {
  findQuestionGrounding,
  GeneratedQuestionValidationError,
  insertGeneratedQuestions,
} from "@/lib/repository";
import {
  generatedQuestionBatchSchema,
  generateQuestionsRequestSchema,
  type GeneratedQuestion,
} from "@/lib/validation";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticateRequest(request);
    assertQuestionAuthor(user);
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return apiError(400, "Request body must be valid JSON");
    }
    const parsed = generateQuestionsRequestSchema.safeParse(json);
    if (!parsed.success) return apiError(400, zodErrorMessage(parsed.error.issues));

    const grounding = await findQuestionGrounding(parsed.data);
    if (!grounding.grammar.length && !grounding.vocabulary.length) {
      return apiError(
        422,
        "No matching NihongoBridge knowledge-base records were found for this level and topic",
      );
    }

    const generated: GeneratedQuestion[] = [];
    let model = "";
    while (generated.length < parsed.data.count) {
      const remaining = parsed.data.count - generated.length;
      const batchCount = Math.min(10, remaining);
      const prompt = questionGenerationPrompt(
        { ...parsed.data, count: batchCount },
        grounding,
      );
      const batch = await generateStructured({
        ...prompt,
        schema: generatedQuestionBatchSchema,
        maxTokens: 8_192,
        signal: request.signal,
      });
      if (batch.data.questions.length !== batchCount) {
        throw new AnthropicError("Anthropic returned the wrong number of questions");
      }
      generated.push(...batch.data.questions);
      model = batch.model;
    }

    const ids = await insertGeneratedQuestions(parsed.data, generated, grounding, model);
    return apiSuccess(
      {
        ids,
        count: ids.length,
        status: "draft",
        provenance: {
          kind: "knowledge-base-synthesis",
          copyrighted_exam_content: false,
        },
      },
      { page: 1, limit: parsed.data.count, total: ids.length },
      201,
    );
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError(error.status, error.message);
    if (error instanceof AnthropicError) return apiError(error.status, error.message);
    if (error instanceof GeneratedQuestionValidationError) {
      return apiError(422, error.message);
    }
    console.error("Question generation failed", error);
    return apiError(500, "Question generation failed");
  }
}
