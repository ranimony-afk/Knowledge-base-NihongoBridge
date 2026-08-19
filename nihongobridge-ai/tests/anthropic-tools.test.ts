import { afterEach, describe, expect, it, vi } from "vitest";

import { streamTutorCompletion } from "@/lib/anthropic";

const toolStream = [
  'event: message_start\ndata: {"message":{"model":"claude-test"}}',
  'event: content_block_start\ndata: {"index":0,"content_block":{"type":"tool_use","id":"tool-1","name":"lookup_dictionary","input":{}}}',
  'event: content_block_delta\ndata: {"index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"query\\":\\"水\\"}"}}',
  'event: content_block_stop\ndata: {"index":0}',
  'event: message_delta\ndata: {"delta":{"stop_reason":"tool_use"}}',
  'event: message_stop\ndata: {}',
].join("\n\n") + "\n\n";

const answerStream = [
  'event: message_start\ndata: {"message":{"model":"claude-test"}}',
  'event: content_block_start\ndata: {"index":0,"content_block":{"type":"text","text":""}}',
  'event: content_block_delta\ndata: {"index":0,"delta":{"type":"text_delta","text":"<ruby>水<rt>みず</rt></ruby> means water."}}',
  'event: content_block_stop\ndata: {"index":0}',
  'event: message_delta\ndata: {"delta":{"stop_reason":"end_turn"}}',
  'event: message_stop\ndata: {}',
].join("\n\n") + "\n\n";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.NIHONGOBRIDGE_API_URL;
});

describe("Anthropic dictionary tool loop", () => {
  it("executes a dictionary lookup and resumes the streamed answer", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    process.env.NIHONGOBRIDGE_API_URL = "https://api.example.test";
    let anthropicCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://api.example.test/api/dictionary/search")) {
        return new Response(JSON.stringify({ data: [{ id: "word-1", word: "水", kana: "みず" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      anthropicCalls += 1;
      return new Response(anthropicCalls === 1 ? toolStream : answerStream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const iterator = streamTutorCompletion({
      system: "You are Hana-sensei.",
      history: [],
      message: "What does 水 mean?",
    });
    let streamed = "";
    let result;
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        result = next.value;
        break;
      }
      streamed += next.value;
    }

    expect(streamed).toContain("<ruby>水");
    expect(result.toolsUsed).toBe(1);
    expect(result.model).toBe("claude-test");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const secondAnthropicRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(String(secondAnthropicRequest.body)).toContain("tool_result");
  });
});
