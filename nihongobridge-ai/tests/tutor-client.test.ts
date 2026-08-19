import { describe, expect, it, vi } from "vitest";

import { readTutorStream } from "@/lib/tutor-client";

describe("tutor SSE client", () => {
  it("appends token events and returns the completed message", async () => {
    const payload = [
      'event: meta\ndata: {"data":{"cached":false},"meta":{"page":1,"limit":1,"total":0}}\n\n',
      'event: token\ndata: {"data":{"text":"こん"},"meta":{"page":1,"limit":1,"total":0}}\n\n',
      'event: token\ndata: {"data":{"text":"にちは"},"meta":{"page":1,"limit":1,"total":0}}\n\n',
      'event: done\ndata: {"data":{"message":"こんにちは"},"meta":{"page":1,"limit":1,"total":1}}\n\n',
    ].join("");
    const tokens: string[] = [];
    const result = await readTutorStream(new Response(payload), (token) => tokens.push(token));
    expect(tokens).toEqual(["こん", "にちは"]);
    expect(result).toBe("こんにちは");
  });

  it("surfaces a wrapped SSE error", async () => {
    const payload = 'event: error\ndata: {"data":{},"meta":{"page":1,"limit":1,"total":0},"error":"Try later"}\n\n';
    await expect(readTutorStream(new Response(payload), vi.fn())).rejects.toThrow("Try later");
  });
});
