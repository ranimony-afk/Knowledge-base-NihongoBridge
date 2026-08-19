import { describe, expect, it, vi } from "vitest";

import { TtlLruCache } from "../search/lib/lru.js";

describe("TtlLruCache", () => {
  it("evicts least-recently-used entries and expires values", () => {
    vi.useFakeTimers();
    const cache = new TtlLruCache<number>(2, 1_000);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    vi.advanceTimersByTime(1_001);
    expect(cache.get("a")).toBeUndefined();
    vi.useRealTimers();
  });
});
