import { describe, expect, it } from "vitest";

import { calculateSm2Schedule } from "@/lib/srs";

describe("SM-2 scheduling", () => {
  it("applies all four confidence formulas and clamps ease", () => {
    expect(calculateSm2Schedule(10, 2.5, 4, "again")).toEqual({
      intervalDays: 1,
      easeFactor: 2.3,
      repetitions: 0,
      wasCorrect: false,
    });
    expect(calculateSm2Schedule(10, 2.5, 4, "hard")).toMatchObject({
      intervalDays: 12,
      easeFactor: 2.35,
      repetitions: 5,
    });
    expect(calculateSm2Schedule(10, 2.5, 4, "good")).toMatchObject({
      intervalDays: 25,
      easeFactor: 2.5,
      repetitions: 5,
    });
    expect(calculateSm2Schedule(10, 2.5, 4, "easy")).toMatchObject({
      intervalDays: 33,
      easeFactor: 2.5,
      repetitions: 5,
    });
  });

  it("never reduces ease below 1.3 or intervals below one day", () => {
    expect(calculateSm2Schedule(1, 1.3, 0, "again")).toMatchObject({
      intervalDays: 1,
      easeFactor: 1.3,
    });
  });
});
