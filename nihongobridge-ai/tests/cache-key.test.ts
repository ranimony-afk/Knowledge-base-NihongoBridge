import { describe, expect, it } from "vitest";

import { explanationCacheKey } from "@/lib/cache-key";

describe("explanation cache keys", () => {
  it("are stable across object key order and sensitive to content", () => {
    const left = explanationCacheKey("grammar", { level: "N4", pattern: "〜てから" });
    const reordered = explanationCacheKey("grammar", { pattern: "〜てから", level: "N4" });
    const changed = explanationCacheKey("grammar", { pattern: "〜ながら", level: "N4" });
    expect(left).toBe(reordered);
    expect(left).not.toBe(changed);
    expect(left).toMatch(/^grammar:[a-f0-9]{64}$/);
  });
});
