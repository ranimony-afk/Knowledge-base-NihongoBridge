import { afterEach, describe, expect, it } from "vitest";

import { consumeTutorQuota, resetRateLimitState } from "@/lib/rate-limit";

const NOW = Date.UTC(2026, 7, 18, 10, 0, 0);

afterEach(async () => {
  delete process.env.REDIS_URL;
  await resetRateLimitState();
});

describe("tutor plan limits", () => {
  it("limits free users to twenty messages in an hourly window", async () => {
    const user = { id: "free-user", roles: [], tier: "free" as const };
    for (let count = 1; count <= 20; count += 1) {
      const quota = await consumeTutorQuota(user, NOW);
      expect(quota.allowed).toBe(true);
      expect(quota.remaining).toBe(20 - count);
    }
    expect((await consumeTutorQuota(user, NOW)).allowed).toBe(false);
  });

  it("does not meter premium users", async () => {
    const user = { id: "premium-user", roles: [], tier: "premium" as const };
    for (let count = 0; count < 30; count += 1) {
      const quota = await consumeTutorQuota(user, NOW);
      expect(quota.allowed).toBe(true);
      expect(quota.limit).toBe("unlimited");
    }
  });
});
