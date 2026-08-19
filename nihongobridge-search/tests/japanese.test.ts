import { describe, expect, it } from "vitest";

import {
  normalizeJapaneseQuery,
  normalizeWidth,
  searchNormalized,
  toHiragana,
  toKatakana,
} from "../search/lib/japanese.js";

describe("Japanese normalization", () => {
  it("normalizes fullwidth Latin and halfwidth katakana with NFKC", () => {
    expect(normalizeWidth("Ｔａｂｅｒｕ ﾐｽﾞ")).toBe("Taberu ミズ");
  });

  it("converts hiragana and katakana equivalents", () => {
    expect(toHiragana("タベル")).toBe("たべる");
    expect(toKatakana("みず")).toBe("ミズ");
    expect(normalizeJapaneseQuery(" ﾀﾍﾞﾙ　水 ")).toBe("たべる 水");
  });

  it("builds indexed search variants without duplicates", () => {
    const value = searchNormalized("食べる", "タベル");
    expect(value).toContain("食べる");
    expect(value).toContain("たべる");
    expect(value).toContain("タベル");
  });
});
