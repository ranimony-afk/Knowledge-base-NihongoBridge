export type JlptFilter = "N5" | "N4" | "N3" | "N2" | "N1";

export interface LocalizedMeaning {
  lang: string;
  value: string;
}

export interface DictionaryMeaning extends LocalizedMeaning {
  pos: string;
}

export interface FuriganaSegment {
  base: string;
  ruby: string;
}

export interface DictionaryEntryData {
  id: string;
  word: string;
  kana: string | null;
  romaji: string | null;
  furigana: FuriganaSegment[];
  meanings: DictionaryMeaning[];
  jlpt_level: string;
  part_of_speech: string[];
  pitch_accent: unknown;
  frequency_rank: number | null;
  kanji_ids: string[];
  audio_url: string | null;
  tags: string[];
  source: string;
}

export interface DictionaryAutocompleteItem {
  id: string;
  word: string;
  kana: string | null;
  meaning: string | null;
  jlpt_level: string;
}

export interface SentenceData {
  id: string;
  japanese: string;
  furigana_html: string | null;
  translations: LocalizedMeaning[];
  audio_url: string | null;
  jlpt_level: string;
  tags: string[];
}

export interface GrammarSummary {
  id: string;
  pattern: string;
  meaning: LocalizedMeaning[];
  formation: string | null;
  jlpt_level: string;
  audio_url: string | null;
}

export interface KanjiData {
  id: string;
  character: string;
  unicode: string | null;
  onyomi: string[];
  kunyomi: string[];
  meanings: LocalizedMeaning[];
  jlpt_level: string;
  grade: number | null;
  frequency_rank: number | null;
  stroke_count: number | null;
  radicals: string[];
  components: string[];
  svg_animation_url: string | null;
  stroke_order_url: string | null;
  similar_kanji: string[];
  lookalikes: string[];
  mnemonics: Array<{ source: string; text: string }>;
  source: string;
}

export interface DictionaryDetailData extends DictionaryEntryData {
  example_sentences: SentenceData[];
  related_kanji: KanjiData[];
  grammar_patterns: GrammarSummary[];
}

export interface KanjiDetailData extends KanjiData {
  example_words: DictionaryEntryData[];
  similar_kanji_details: KanjiData[];
}

export interface DictionarySearchFilters {
  q: string;
  level?: JlptFilter | undefined;
  pos?: string | undefined;
  hasAudio: boolean;
  page: number;
}

export interface SrsReviewContent {
  id: string;
  itemType: "word" | "kanji" | "grammar";
  front: string;
  reading?: string | undefined;
  meanings: string[];
  example?: string | undefined;
  grammar?: string | undefined;
  jlptLevel?: string | undefined;
}

export type SrsConfidence = "again" | "hard" | "good" | "easy";
