import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearMemoryCache } from "@/middleware/cache";
import { clearLocalRateLimits } from "@/middleware/rateLimit";

const searchDictionary = vi.fn(async () => ({
  items: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      word: "水",
      kana: "みず",
      romaji: "mizu",
      furigana: [{ base: "水", ruby: "みず" }],
      meanings: [{ lang: "en", value: "water", pos: "noun" }],
      jlpt_level: "N5",
      part_of_speech: ["noun"],
      pitch_accent: null,
      frequency_rank: 1,
      kanji_ids: ["水"],
      audio_url: null,
      tags: [],
      source: "fixture",
    },
  ],
  total: 1,
  engine: "postgresql" as const,
}));

vi.mock("@/lib/search", () => ({ searchDictionary }));

beforeEach(() => {
  delete process.env.REDIS_URL;
  clearMemoryCache();
  clearLocalRateLimits();
  searchDictionary.mockClear();
});

describe("route envelopes", () => {
  it("returns a consistent validation error envelope", async () => {
    const { GET } = await import("@/app/api/dictionary/search/route");
    const response = await GET(new NextRequest("http://localhost/api/dictionary/search"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      data: null,
      meta: { page: 1, limit: 0, total: 0 },
    });
    expect(body.error).toContain("q");
  });

  it("caches successful dictionary searches and returns X-Cache", async () => {
    const { GET } = await import("@/app/api/dictionary/search/route");
    const request = () =>
      new NextRequest("http://localhost/api/dictionary/search?q=%E6%B0%B4&page=1&limit=20", {
        headers: { "x-forwarded-for": "198.51.100.20" },
      });

    const first = await GET(request());
    const second = await GET(request());
    const body = await second.json();

    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("HIT");
    expect(body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(body.data[0].word).toBe("水");
    expect(searchDictionary).toHaveBeenCalledTimes(1);
  });
});
