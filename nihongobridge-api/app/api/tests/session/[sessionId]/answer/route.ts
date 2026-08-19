import type { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth";
import {
  nextUnansweredIndex,
  sectionIsComplete,
  sessionTiming,
  updateSession,
} from "@/lib/session";
import { TestEngineError } from "@/lib/testEngine";
import { rateLimit, rateLimitHeaders } from "@/middleware/rateLimit";
import type { AnswerTestResponse } from "@/types/test";
import { apiError, apiSuccess, zodErrorMessage } from "@/utils/response";
import { testApiError } from "@/utils/testResponse";
import { answerTestSchema, sessionIdSchema } from "@/utils/testValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { sessionId: string };
}

/**
 * @openapi
 * /api/tests/session/{sessionId}/answer:
 *   post:
 *     summary: Save an answer and advance to the next unanswered question
 *     tags: [Tests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: sessionId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question_id, selected, time_taken_ms]
 *             properties:
 *               question_id: { type: string, format: uuid }
 *               selected: { type: string }
 *               time_taken_ms: { type: integer, minimum: 0 }
 *     responses:
 *       '200': { description: Next question and completion flags; never includes answer keys }
 *       '403': { description: Session belongs to another user }
 *       '409': { description: Session is already complete }
 *       '429': { description: Rate limit exceeded }
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  let rateHeaders: Record<string, string> | undefined;
  try {
    const authenticated = await authenticateRequest(request);
    const rate = await rateLimit(request, { authenticatedUserId: authenticated.id });
    rateHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) return apiError(429, "Rate limit exceeded", undefined, rateHeaders);

    const sessionId = sessionIdSchema.safeParse(params.sessionId);
    if (!sessionId.success) {
      return apiError(400, zodErrorMessage(sessionId.error.issues), undefined, rateHeaders);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Request body must be valid JSON", undefined, rateHeaders);
    }
    const parsed = answerTestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, zodErrorMessage(parsed.error.issues), undefined, rateHeaders);
    }

    let response: AnswerTestResponse | undefined;
    await updateSession(sessionId.data, (state) => {
      if (state.user_id !== authenticated.id) throw new TestEngineError("Forbidden", 403);
      if (state.status !== "active") throw new TestEngineError("Test is already complete", 409);
      const timing = sessionTiming(state);
      const questionIndex = state.questions.findIndex(
        (question) => question.id === parsed.data.question_id,
      );
      if (questionIndex < 0) throw new TestEngineError("Question is not in this test", 400);
      const question = state.questions[questionIndex]!;
      if (!question.options.some((option) => option.id === parsed.data.selected)) {
        throw new TestEngineError("Selected option is invalid", 400);
      }
      if (timing.remaining === 0) {
        response = {
          section_complete: sectionIsComplete(state, question.section_type),
          test_complete: true,
          time_remaining: 0,
        };
        return state;
      }

      state.answers[question.id] = {
        question_id: question.id,
        selected: parsed.data.selected,
        time_taken_ms: parsed.data.time_taken_ms,
        answered_at: new Date().toISOString(),
      };
      state.current_index = nextUnansweredIndex(state, questionIndex);
      const testComplete = state.current_index >= state.questions.length;
      const nextQuestion = testComplete ? undefined : state.questions[state.current_index];
      response = {
        ...(nextQuestion ? { next_question: nextQuestion } : {}),
        section_complete: sectionIsComplete(state, question.section_type),
        test_complete: testComplete,
        time_remaining: sessionTiming(state).remaining,
      };
      return state;
    });
    if (!response) throw new TestEngineError("Answer could not be recorded", 500);
    return apiSuccess(response, { page: 1, limit: 1, total: 1 }, {
      headers: { ...rateHeaders, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return testApiError(error, rateHeaders);
  }
}
