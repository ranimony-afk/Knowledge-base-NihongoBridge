import { describe, expect, it } from "vitest";

import { calculateTestScore, type ScorableQuestion } from "@/lib/scoring";
import type { SessionAnswer, TestSectionType } from "@/types/test";

function questions(section: TestSectionType, count: number, start: number): ScorableQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `q-${start + index}`,
    sectionType: section,
    correctAnswer: "a",
  }));
}

function answersFor(items: ScorableQuestion[], correct: number): Record<string, SessionAnswer> {
  return Object.fromEntries(
    items.map((question, index) => [
      question.id,
      {
        question_id: question.id,
        selected: index < correct ? "a" : "b",
        time_taken_ms: 1_000,
        answered_at: "2026-08-18T00:00:00.000Z",
      },
    ]),
  );
}

describe("JLPT-style scoring", () => {
  it("scales vocabulary, grammar+reading, and listening to 60 points each", () => {
    const vocabulary = questions("vocabulary", 10, 0);
    const grammar = questions("grammar", 5, 10);
    const reading = questions("reading", 5, 15);
    const listening = questions("listening", 10, 20);
    const all = [...vocabulary, ...grammar, ...reading, ...listening];
    const answers = {
      ...answersFor(vocabulary, 5),
      ...answersFor([...grammar, ...reading], 8),
      ...answersFor(listening, 10),
    };

    const score = calculateTestScore(all, answers, "full_mock");

    expect(score.score_by_section.vocabulary.score).toBe(30);
    expect(score.score_by_section.grammar_reading.score).toBe(48);
    expect(score.score_by_section.listening.score).toBe(60);
    expect(score.score_total).toBe(138);
    expect(score.accuracy).toBe(76.7);
    expect(score.passed).toBe(true);
  });

  it("enforces the per-section minimum even above 90 total points", () => {
    const vocabulary = questions("vocabulary", 10, 0);
    const grammar = questions("grammar", 10, 10);
    const listening = questions("listening", 10, 20);
    const all = [...vocabulary, ...grammar, ...listening];
    const answers = {
      ...answersFor(vocabulary, 2),
      ...answersFor(grammar, 10),
      ...answersFor(listening, 10),
    };

    const score = calculateTestScore(all, answers, "full_mock");

    expect(score.score_total).toBe(132);
    expect(score.score_by_section.vocabulary.minimum_met).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("uses a 30/60 pass threshold for a section drill", () => {
    const vocabulary = questions("vocabulary", 10, 0);
    const score = calculateTestScore(vocabulary, answersFor(vocabulary, 5), "section_drill");
    expect(score.score_total).toBe(30);
    expect(score.passed).toBe(true);
  });
});
