import { beforeEach, describe, expect, it, vi } from "vitest";

import { cacheKey, clearMemoryCache, withCache } from "@/middleware/cache";

beforeEach(() => {
  delete process.env.REDIS_URL;
  clearMemoryCache();
});

describe("cache wrapper", () => {
  it("returns MISS then HIT and uses stable hashed keys", async () => {
    const loader = vi.fn(async () => ({ value: 42 }));
    const key = cacheKey("fixture", { q: "水", page: 1 });

    const first = await withCache(key, 60, loader);
    const second = await withCache(key, 60, loader);

    expect(first.status).toBe("MISS");
    expect(second.status).toBe("HIT");
    expect(second.value).toEqual({ value: 42 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(key).not.toContain("水");
  });

  it("does not retain values rejected by the cache policy", async () => {
    const loader = vi.fn(async () => null);
    await withCache("negative", 60, loader, (value) => value !== null);
    await withCache("negative", 60, loader, (value) => value !== null);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent cache misses", async () => {
    const loader = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "loaded";
    });
    const [first, second] = await Promise.all([
      withCache("same-key", 60, loader),
      withCache("same-key", 60, loader),
    ]);
    expect(first.value).toBe("loaded");
    expect(second.value).toBe("loaded");
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
