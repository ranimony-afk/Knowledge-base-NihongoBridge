export function normalizeWidth(value: string): string {
  return value.normalize("NFKC");
}

export function toHiragana(value: string): string {
  return normalizeWidth(value)
    .replace(/[ァ-ヶ]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    )
    .replace(/ヷ/g, "わ゙")
    .replace(/ヸ/g, "ゐ゙")
    .replace(/ヹ/g, "ゑ゙")
    .replace(/ヺ/g, "を゙");
}

export function toKatakana(value: string): string {
  return normalizeWidth(value).replace(/[ぁ-ゖ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) + 0x60),
  );
}

export function normalizeJapaneseQuery(value: string): string {
  return toHiragana(normalizeWidth(value))
    .replace(/[\u3000\s]+/g, " ")
    .trim();
}

export function searchNormalized(...values: Array<string | null | undefined>): string {
  const variants = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeWidth(value).replace(/[\u3000\s]+/g, " ").trim();
    if (!normalized) continue;
    variants.add(normalized);
    variants.add(toHiragana(normalized));
    variants.add(toKatakana(normalized));
  }
  return [...variants].join(" ");
}
