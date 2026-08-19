export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
  error?: string;
}

export interface FuriganaSegmentDto {
  base: string;
  ruby: string;
}

export interface DictionaryMeaningDto {
  lang: string;
  value: string;
  pos: string;
}

export interface DictionaryEntryDto {
  id: string;
  word: string;
  kana: string | null;
  romaji: string | null;
  furigana: FuriganaSegmentDto[];
  meanings: DictionaryMeaningDto[];
  jlpt_level: string;
  part_of_speech: string[];
  pitch_accent: unknown;
  frequency_rank: number | null;
  kanji_ids: string[];
  audio_url: string | null;
  tags: string[];
  source: string;
}

export interface DictionaryAutocompleteDto {
  id: string;
  word: string;
  kana: string | null;
  meaning: string | null;
  jlpt_level: string;
}

export interface SentenceDto {
  id: string;
  japanese: string;
  furigana_html: string | null;
  translations: Array<{ lang: string; value: string }>;
  audio_url: string | null;
  jlpt_level: string;
  tags: string[];
}

export interface GrammarSummaryDto {
  id: string;
  pattern: string;
  meaning: Array<{ lang: string; value: string }>;
  formation: string | null;
  jlpt_level: string;
  audio_url: string | null;
}

export interface GrammarDetailDto extends GrammarSummaryDto {
  pattern_plain: string | null;
  formation_diagram: unknown;
  examples: Array<{
    jp: string;
    reading: string;
    translations: Array<{ lang: string; value: string }>;
  }>;
  common_mistakes: string | null;
  related_pattern_ids: string[];
  notes: string | null;
  tags: string[];
  source: string;
}

export interface KanjiEntryDto {
  id: string;
  character: string;
  unicode: string | null;
  onyomi: string[];
  kunyomi: string[];
  meanings: Array<{ lang: string; value: string }>;
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

export interface DictionaryDetailDto extends DictionaryEntryDto {
  example_sentences: SentenceDto[];
  related_kanji: KanjiEntryDto[];
  grammar_patterns: GrammarSummaryDto[];
}

export interface KanjiDetailDto extends KanjiEntryDto {
  example_words: DictionaryEntryDto[];
  similar_kanji_details: KanjiEntryDto[];
}

export type KanjiQuizType = "reading" | "meaning" | "all";

export interface KanjiQuizDto {
  character: string;
  quiz_type: KanjiQuizType;
  prompt: string;
  visible: {
    onyomi?: string[];
    kunyomi?: string[];
    meanings?: Array<{ lang: string; value: string }>;
    stroke_count: number | null;
    jlpt_level: string;
  };
  hidden_fields: Array<"onyomi" | "kunyomi" | "meanings">;
}

export interface SearchPage<T> {
  items: T[];
  total: number;
  engine: "postgresql" | "meilisearch";
}
