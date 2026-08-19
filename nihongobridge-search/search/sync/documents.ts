import { searchNormalized } from "../lib/japanese.js";

export interface DictionaryRow {
  id: string;
  word: string;
  kana: string | null;
  romaji: string | null;
  meanings: Array<{ lang?: string; value?: string; pos?: string }>;
  jlpt_level: string;
  part_of_speech: string[];
  frequency_rank: number | null;
  tags: string[];
  audio_url: string | null;
  is_active: boolean;
  updated_at: Date;
}

export interface KanjiRow {
  id: string;
  character: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: Array<{ lang?: string; value?: string }>;
  jlpt_level: string;
  grade: number | null;
  stroke_count: number | null;
  frequency_rank: number | null;
  updated_at: Date;
}

export interface GrammarRow {
  id: string;
  pattern: string;
  pattern_plain: string | null;
  meaning: Array<{ lang?: string; value?: string }>;
  jlpt_level: string;
  tags: string[];
  updated_at: Date;
}

export interface SentenceRow {
  id: string;
  japanese: string;
  translations: Array<{ lang?: string; value?: string }>;
  jlpt_level: string;
  tags: string[];
  updated_at: Date;
}

export function dictionaryDocument(row: DictionaryRow) {
  const meanings = values(row.meanings);
  return {
    id: row.id,
    word: row.word,
    kana: row.kana,
    romaji: row.romaji,
    meanings,
    jlpt_level: row.jlpt_level,
    part_of_speech: row.part_of_speech,
    frequency_rank: row.frequency_rank,
    tags: row.tags,
    has_audio: Boolean(row.audio_url),
    search_normalized: searchNormalized(row.word, row.kana, row.romaji, ...meanings),
    updated_at: row.updated_at.toISOString(),
  };
}

export function autocompleteDocument(row: DictionaryRow) {
  return {
    id: row.id,
    word: row.word,
    kana: row.kana,
    search_normalized: searchNormalized(row.word, row.kana),
  };
}

export function kanjiDocument(row: KanjiRow) {
  const meanings = values(row.meanings);
  return {
    id: row.id,
    character: row.character,
    onyomi: row.onyomi,
    kunyomi: row.kunyomi,
    meanings,
    jlpt_level: row.jlpt_level,
    grade: row.grade,
    stroke_count: row.stroke_count,
    frequency_rank: row.frequency_rank,
    search_normalized: searchNormalized(
      row.character,
      ...row.onyomi,
      ...row.kunyomi,
      ...meanings,
    ),
    updated_at: row.updated_at.toISOString(),
  };
}

export function grammarDocument(row: GrammarRow) {
  const meanings = values(row.meaning);
  return {
    id: row.id,
    pattern: row.pattern,
    pattern_plain: row.pattern_plain,
    meaning: meanings,
    jlpt_level: row.jlpt_level,
    tags: row.tags,
    search_normalized: searchNormalized(row.pattern, row.pattern_plain, ...meanings),
    updated_at: row.updated_at.toISOString(),
  };
}

export function sentenceDocument(row: SentenceRow) {
  const translations = values(row.translations);
  return {
    id: row.id,
    japanese: row.japanese,
    translations,
    jlpt_level: row.jlpt_level,
    tags: row.tags,
    search_normalized: searchNormalized(row.japanese, ...translations),
    updated_at: row.updated_at.toISOString(),
  };
}

function values(items: Array<{ value?: string }>): string[] {
  return items.map((item) => item.value).filter((value): value is string => Boolean(value));
}
