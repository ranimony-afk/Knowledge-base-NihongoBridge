import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSessionMemory,
  createSession,
  getSession,
  nextUnansweredIndex,
  sectionIsComplete,
  toSessionStatus,
  updateSession,
} from "@/lib/session";

import { ids, sessionFixture } from "@/tests/fixtures/session";

beforeEach(() => {
  delete process.env.REDIS_URL;
  process.env.SESSION_REQUIRE_REDIS = "false";
  clearSessionMemory();
});

describe("Redis session state facade", () => {
  it("creates, updates, and returns only public question state", async () => {
    const state = sessionFixture();
    await createSession(state);
    await updateSession(state.session_id, (current) => {
      current.answers[ids.question1] = {
        question_id: ids.question1,
        selected: "a",
        time_taken_ms: 900,
        answered_at: new Date().toISOString(),
      };
      current.current_index = nextUnansweredIndex(current, 0);
      return current;
    });

    const stored = await getSession(state.session_id);
    expect(stored?.current_index).toBe(1);
    expect(sectionIsComplete(stored!, "vocabulary")).toBe(false);
    const response = toSessionStatus(stored!);
    expect(response.current_question?.id).toBe(ids.question2);
    expect(response.answers_so_far).toHaveLength(1);
    expect(JSON.stringify(response)).not.toContain("correct_answer");
  });
});
