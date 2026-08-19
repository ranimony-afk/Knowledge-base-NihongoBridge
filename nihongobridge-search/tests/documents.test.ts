import { describe, expect, it } from "vitest";

import {
  autocompleteDocument,
  dictionaryDocument,
  grammarDocument,
} from "../search/sync/documents.js";

describe("search document mapping", () => {
  it("flattens meanings, audio facets, and kana variants", () => {
    const row = {
      id: "id-1",
      word: "食べる",
      kana: "タベル",
      romaji: "taberu",
      meanings: [{ lang: "en", value: "to eat", pos: "verb" }],
      jlpt_level: "N5",
      part_of_speech: ["verb"],
      frequency_rank: 100,
      tags: ["food"],
      audio_url: "/audio.mp3",
      is_active: true,
      updated_at: new Date("2026-08-18T00:00:00Z"),
    };
    const document = dictionaryDocument(row);
    expect(document.meanings).toEqual(["to eat"]);
    expect(document.has_audio).toBe(true);
    expect(document.search_normalized).toContain("たべる");
    expect(autocompleteDocument(row)).toMatchObject({ id: "id-1", word: "食べる" });
  });

  it("maps grammar patterns into normalized searchable text", () => {
    const document = grammarDocument({
      id: "g1",
      pattern: "〜てから",
      pattern_plain: "te kara",
      meaning: [{ value: "after doing" }],
      jlpt_level: "N5",
      tags: [],
      updated_at: new Date("2026-08-18T00:00:00Z"),
    });
    expect(document.search_normalized).toContain("after doing");
  });
});
