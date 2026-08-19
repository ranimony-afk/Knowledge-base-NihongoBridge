import {
  dictionaryEntries,
  grammarPatterns,
  kanjiEntries,
  sentences,
} from "@nihongobridge/knowledge";
import { and, eq, inArray } from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import {
  dictionaryDto,
  grammarDetailDto,
  kanjiDto,
  sentenceDto,
} from "@/lib/serializers";
import type {
  DictionaryEntryDto,
  GrammarDetailDto,
  KanjiEntryDto,
  SentenceDto,
} from "@/types/api";

export type ContentItemType = "word" | "kanji" | "grammar" | "sentence";
export type HydratedContent =
  | DictionaryEntryDto
  | KanjiEntryDto
  | GrammarDetailDto
  | SentenceDto;

export interface ContentReference {
  itemType: ContentItemType;
  itemId: string;
}

export function contentKey(itemType: ContentItemType, itemId: string): string {
  return `${itemType}:${itemId}`;
}

export async function hydrateContentItems(
  references: ContentReference[],
): Promise<Map<string, HydratedContent>> {
  const grouped: Record<ContentItemType, string[]> = {
    word: [],
    kanji: [],
    grammar: [],
    sentence: [],
  };
  for (const reference of references) grouped[reference.itemType].push(reference.itemId);
  const db = getDatabase();
  const [wordRows, kanjiRows, grammarRows, sentenceRows] = await Promise.all([
    grouped.word.length
      ? db
          .select()
          .from(dictionaryEntries)
          .where(
            and(
              inArray(dictionaryEntries.id, [...new Set(grouped.word)]),
              eq(dictionaryEntries.isActive, true),
            ),
          )
      : [],
    grouped.kanji.length
      ? db
          .select()
          .from(kanjiEntries)
          .where(inArray(kanjiEntries.id, [...new Set(grouped.kanji)]))
      : [],
    grouped.grammar.length
      ? db
          .select()
          .from(grammarPatterns)
          .where(inArray(grammarPatterns.id, [...new Set(grouped.grammar)]))
      : [],
    grouped.sentence.length
      ? db.select().from(sentences).where(inArray(sentences.id, [...new Set(grouped.sentence)]))
      : [],
  ]);
  const output = new Map<string, HydratedContent>();
  for (const row of wordRows) output.set(contentKey("word", row.id), dictionaryDto(row));
  for (const row of kanjiRows) output.set(contentKey("kanji", row.id), kanjiDto(row));
  for (const row of grammarRows) {
    output.set(contentKey("grammar", row.id), grammarDetailDto(row));
  }
  for (const row of sentenceRows) output.set(contentKey("sentence", row.id), sentenceDto(row));
  return output;
}

export async function contentItemExists(
  itemType: ContentItemType,
  itemId: string,
): Promise<boolean> {
  const hydrated = await hydrateContentItems([{ itemType, itemId }]);
  return hydrated.has(contentKey(itemType, itemId));
}
