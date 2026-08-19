import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { clearLocalRateLimits } from "@/middleware/rateLimit";
import { clearSessionMemory, createSession } from "@/lib/session";
import { sessionFixture } from "@/tests/fixtures/session";

beforeEach(() => {
  delete process.env.REDIS_URL;
  process.env.SESSION_REQUIRE_REDIS = "false";
  process.env.ALLOW_INSECURE_USER_HEADER = "true";
  clearSessionMemory();
  clearLocalRateLimits();
});

describe("test-taking routes", () => {
  it("records an answer without exposing correctness", async () => {
    const state = sessionFixture();
    await createSession(state);
    const { POST } = await import("@/app/api/tests/session/[sessionId]/answer/route");
    const request = new NextRequest(
      `http://localhost/api/tests/session/${state.session_id}/answer`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": state.user_id,
          "x-forwarded-for": "192.0.2.10",
        },
        body: JSON.stringify({
          question_id: state.questions[0]!.id,
          selected: "a",
          time_taken_ms: 1_200,
        }),
      },
    );

    const response = await POST(request, { params: { sessionId: state.session_id } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.next_question.id).toBe(state.questions[1]!.id);
    expect(body.data.test_complete).toBe(false);
    expect(JSON.stringify(body)).not.toContain("correct_answer");
    expect(JSON.stringify(body)).not.toContain("explanation_en");
  });

  it("rejects malformed byte ranges before storage access", async () => {
    const { GET } = await import("@/app/api/listening/[questionId]/audio/route");
    const questionId = "00000000-0000-4000-8000-000000000200";
    const request = new NextRequest(`http://localhost/api/listening/${questionId}/audio`, {
      headers: { range: "bytes=20-10", "x-forwarded-for": "192.0.2.11" },
    });

    const response = await GET(request, { params: { questionId } });
    expect(response.status).toBe(416);
    expect((await response.json()).error).toContain("byte range");
  });

  it("requires an admin role for server-side TTS generation", async () => {
    const { POST } = await import("@/app/api/listening/generate/route");
    const request = new NextRequest("http://localhost/api/listening/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "00000000-0000-4000-8000-000000000300",
      },
      body: JSON.stringify({ script: [{ text: "こんにちは。" }], voice_config: {} }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});
