"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import {
  completeTest,
  loadTestSession,
  submitTestAnswer,
} from "@/lib/api-client";
import { clearSessionSnapshot, useSessionPersistence } from "@/hooks/useSessionPersistence";
import { useTestSessionStore } from "@/stores/test-session-store";

export function useTestSession(sessionId: string) {
  const router = useRouter();
  const initialize = useTestSessionStore((state) => state.initialize);
  const setError = useTestSessionStore((state) => state.setError);
  const tick = useTestSessionStore((state) => state.tick);
  const currentQuestion = useTestSessionStore((state) => state.currentQuestion);
  const timeRemaining = useTestSessionStore((state) => state.timeRemaining);
  const timerPaused = useTestSessionStore((state) => state.timerPaused);
  const hydrated = useTestSessionStore((state) => state.hydrated);
  const completing = useTestSessionStore((state) => state.completing);
  const enteredAt = useRef(Date.now());
  const requestControllers = useRef(new Map<string, AbortController>());
  const expiryHandled = useRef(false);

  useSessionPersistence();

  const reload = useCallback(() => {
    const controller = new AbortController();
    expiryHandled.current = false;
    useTestSessionStore.getState().reset();
    void loadTestSession(sessionId, controller.signal)
      .then(initialize)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError(error instanceof Error ? error.message : "Could not load this test session.");
      });
    return () => controller.abort();
  }, [initialize, sessionId, setError]);

  useEffect(() => reload(), [reload]);

  useEffect(() => {
    enteredAt.current = Date.now();
  }, [currentQuestion?.id]);

  useEffect(() => {
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [tick]);

  const finish = useCallback(async () => {
    const state = useTestSessionStore.getState();
    if (!state.sessionId || state.completing) return;
    state.setCompleting(true);
    try {
      await completeTest(state.sessionId);
      clearSessionSnapshot(state.sessionId);
      router.push(`/test/${state.sessionId}/results`);
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Could not complete the test.");
      state.setCompleting(false);
    }
  }, [router]);

  useEffect(() => {
    if (!hydrated || timeRemaining > 0 || timerPaused || expiryHandled.current) return;
    expiryHandled.current = true;
    void finish();
  }, [finish, hydrated, timeRemaining, timerPaused]);

  const answer = useCallback(
    async (selected: string) => {
      const state = useTestSessionStore.getState();
      const question = state.currentQuestion;
      if (!state.sessionId || !question) return;
      const responseTime = Math.max(0, Date.now() - enteredAt.current);
      const answerValue = {
        question_id: question.id,
        selected,
        time_taken_ms: responseTime,
        answered_at: new Date().toISOString(),
      };
      state.selectAnswer(answerValue);

      requestControllers.current.get(question.id)?.abort();
      const controller = new AbortController();
      requestControllers.current.set(question.id, controller);
      try {
        const result = await submitTestAnswer(
          state.sessionId,
          answerValue,
          controller.signal,
        );
        if (result.next_question) state.addQuestion(result.next_question);
        state.setServerTimeRemaining(result.time_remaining);
        state.setAnswerSync(question.id, "saved");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        state.setAnswerSync(question.id, "error");
        state.setError(error instanceof Error ? error.message : "Your answer was not saved.");
      } finally {
        if (requestControllers.current.get(question.id) === controller) {
          requestControllers.current.delete(question.id);
        }
      }
    },
    [],
  );

  return { answer, finish, reload, completing };
}
