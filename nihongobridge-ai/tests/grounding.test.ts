import { describe, expect, it } from "vitest";

import { validateQuestionGrounding, type KnowledgeGrounding } from "@/lib/repository";
import type { GeneratedQuestion } from "@/lib/validation";

const WORD_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const grounding: KnowledgeGrounding = {
  grammar: [],
  vocabulary: [{
    id: WORD_ID,
    word: "水",
    kana: "みず",
    meanings: [{ lang: "en", value: "water" }],
    part_of_speech: ["noun"],
    jlpt_level: "N5",
    source: "jmdict",
  }],
};
const question: GeneratedQuestion = {
  question_jp: "水はどれですか。",
  question_en: null,
  stimulus: null,
  options: [
    { id: "A", text_jp: "みず", text_en: "water" },
    { id: "B", text_jp: "ひ", text_en: "fire" },
  ],
  correct_answer: "A",
  explanation_jp: "水はみずです。",
  explanation_en: "水 is read みず.",
  difficulty: 1,
  time_limit_seconds: 30,
  tags: ["water"],
  grounding_vocabulary_ids: [WORD_ID],
  grounding_grammar_ids: [],
};

describe("generated question grounding", () => {
  it("accepts citations from the supplied knowledge set", () => {
    expect(() => validateQuestionGrounding([question], grounding)).not.toThrow();
  });

  it("rejects invented knowledge IDs", () => {
    expect(() => validateQuestionGrounding([
      { ...question, grounding_vocabulary_ids: [OTHER_ID] },
    ], grounding)).toThrow(/outside the supplied grounding set/);
  });
});
