import { describe, expect, it } from "vitest";

import {
  generatedQuestionSchema,
  tutorChatRequestSchema,
} from "@/lib/validation";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("AI request validation", () => {
  it("accepts at most ten prior tutor messages", () => {
    const valid = tutorChatRequestSchema.safeParse({
      message: "Explain 〜てから",
      context: {
        current_level: "N4",
        recent_mistakes: [UUID],
        current_topic: UUID,
        language_preference: "en",
      },
      conversation_history: Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 ? "assistant" : "user",
        content: `message ${index}`,
      })),
    });
    expect(valid.success).toBe(true);

    const invalid = tutorChatRequestSchema.safeParse({
      ...(valid.success ? valid.data : {}),
      conversation_history: Array.from({ length: 11 }, () => ({ role: "user", content: "x" })),
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects a generated question whose answer is not one of its options", () => {
    const result = generatedQuestionSchema.safeParse({
      question_jp: "どれですか。",
      question_en: null,
      stimulus: null,
      options: [
        { id: "A", text_jp: "水", text_en: "water" },
        { id: "B", text_jp: "火", text_en: "fire" },
      ],
      correct_answer: "C",
      explanation_jp: "Aです。",
      explanation_en: "A is correct.",
      difficulty: 1,
      time_limit_seconds: 30,
      tags: ["water"],
      grounding_vocabulary_ids: [UUID],
      grounding_grammar_ids: [],
    });
    expect(result.success).toBe(false);
  });
});
