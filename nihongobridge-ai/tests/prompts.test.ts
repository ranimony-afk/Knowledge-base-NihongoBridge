import { describe, expect, it } from "vitest";

import { buildTutorSystemPrompt } from "@/lib/prompts";

const EMPTY_GROUNDING = { grammar: [], vocabulary: [] };

describe("Hana-sensei system prompt", () => {
  it("injects level, weak areas, topic, language, furigana, and length rules", () => {
    const prompt = buildTutorSystemPrompt(
      {
        current_level: "N3",
        recent_mistakes: ["grammar-1", "word-2"],
        current_topic: "〜ように",
        language_preference: "ta",
      },
      EMPTY_GROUNDING,
    );
    expect(prompt).toContain("JLPT N3");
    expect(prompt).toContain("grammar-1, word-2");
    expect(prompt).toContain("〜ように");
    expect(prompt).toContain("Tamil");
    expect(prompt).toContain("<ruby>");
    expect(prompt).toContain("maximum 200 words");
    expect(prompt).toContain("lookup_dictionary");
  });
});
