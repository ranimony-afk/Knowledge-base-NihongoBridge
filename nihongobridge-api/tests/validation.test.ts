import { describe, expect, it } from "vitest";

import { toPagination } from "@/utils/pagination";
import { globalSearchSchema } from "@/utils/contentValidation";
import { listeningGenerateSchema } from "@/utils/testValidation";
import {
  dictionaryBulkSchema,
  dictionarySearchSchema,
  kanjiCharacterSchema,
  kanjiSearchSchema,
} from "@/utils/validation";

describe("request validation", () => {
  it("coerces pagination and computes offsets", () => {
    const parsed = dictionarySearchSchema.parse({
      q: "水",
      page: "3",
      limit: "25",
      has_audio: "true",
    });
    expect(parsed).toMatchObject({ q: "水", page: 3, limit: 25, has_audio: true });
    expect(toPagination(parsed.page, parsed.limit)).toEqual({ page: 3, limit: 25, offset: 50 });
  });

  it("rejects invalid stroke ranges and empty kanji filters", () => {
    expect(kanjiSearchSchema.safeParse({ stroke_min: "10", stroke_max: "2" }).success).toBe(
      false,
    );
    expect(kanjiSearchSchema.safeParse({}).success).toBe(false);
  });

  it("parses and deduplicates global search type filters", () => {
    const parsed = globalSearchSchema.parse({ q: "水", types: "word,kanji,word" });
    expect(parsed.types).toEqual(["word", "kanji"]);
    expect(globalSearchSchema.safeParse({ q: "水", types: "word,unknown" }).success).toBe(
      false,
    );
  });

  it("restricts server-side TTS to Japanese neural voices", () => {
    expect(
      listeningGenerateSchema.safeParse({
        script: [{ text: "こんにちは。" }],
        voice_config: { female_voice: "ja-JP-NanamiNeural" },
      }).success,
    ).toBe(true);
    expect(
      listeningGenerateSchema.safeParse({
        script: [{ text: "こんにちは。" }],
        voice_config: { female_voice: "en-US-AriaNeural" },
      }).success,
    ).toBe(false);
  });

  it("validates one Unicode kanji and bulk UUID limits", () => {
    expect(kanjiCharacterSchema.safeParse("水").success).toBe(true);
    expect(kanjiCharacterSchema.safeParse("水曜").success).toBe(false);
    const id = "00000000-0000-4000-8000-000000000001";
    expect(dictionaryBulkSchema.parse({ ids: [id, id] }).ids).toEqual([id]);
    expect(
      dictionaryBulkSchema.safeParse({ ids: Array.from({ length: 101 }, () => id) }).success,
    ).toBe(false);
  });
});
