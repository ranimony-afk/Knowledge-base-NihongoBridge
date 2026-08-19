import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { clearLocalRateLimits, rateLimit } from "@/middleware/rateLimit";

beforeEach(() => {
  delete process.env.REDIS_URL;
  clearLocalRateLimits();
});

describe("rate limiting", () => {
  it("allows 100 anonymous requests and rejects the next request", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    for (let index = 0; index < 100; index += 1) {
      expect((await rateLimit(request)).allowed).toBe(true);
    }
    const blocked = await rateLimit(request);
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(100);
    expect(blocked.remaining).toBe(0);
  });

  it("uses the 1000 request tier only for a verified user argument", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const result = await rateLimit(request, { authenticatedUserId: "verified-user" });
    expect(result.limit).toBe(1_000);
    expect(result.allowed).toBe(true);
  });
});
