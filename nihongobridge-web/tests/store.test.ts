import { beforeEach, describe, expect, it } from "vitest";

import { demoQuestions, demoSessionStatus } from "@/lib/demo-session";
import {
  sessionSnapshot,
  useTestSessionStore,
} from "@/stores/test-session-store";

beforeEach(() => useTestSessionStore.getState().reset());

describe("test session store", () => {
  it("initializes, answers, flags, navigates, and serializes", () => {
    const store = useTestSessionStore.getState();
    store.initialize({ status: demoSessionStatus(), knownQuestions: demoQuestions });
    expect(useTestSessionStore.getState().currentQuestion?.id).toBe("demo-v1");

    store.selectAnswer({
      question_id: "demo-v1",
      selected: "a",
      time_taken_ms: 500,
      answered_at: new Date().toISOString(),
    });
    store.setAnswerSync("demo-v1", "saved");
    store.toggleFlag("demo-v1");
    store.goNext();

    const state = useTestSessionStore.getState();
    expect(state.currentQuestion?.id).toBe("demo-v2");
    expect(state.answers["demo-v1"]?.selected).toBe("a");
    expect(state.flaggedQuestions.has("demo-v1")).toBe(true);
    expect(sessionSnapshot()).toMatchObject({
      sessionId: "demo",
      currentQuestionIndex: 1,
      flaggedQuestionIds: ["demo-v1"],
    });
  });

  it("does not decrement the test clock while listening audio pauses it", () => {
    const store = useTestSessionStore.getState();
    store.initialize({ status: demoSessionStatus(), knownQuestions: demoQuestions });
    const original = useTestSessionStore.getState().timeRemaining;
    store.setTimerPaused(true);
    store.tick();
    expect(useTestSessionStore.getState().timeRemaining).toBe(original);
    store.setTimerPaused(false);
    store.tick();
    expect(useTestSessionStore.getState().timeRemaining).toBe(original - 1);
  });
});
