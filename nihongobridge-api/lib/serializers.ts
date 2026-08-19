import type {
  dictionaryEntries,
  grammarPatterns,
  kanjiEntries,
  sentences,
} from "@nihongobridge/knowledge";

import type {
  DictionaryEntryDto,
  GrammarDetailDto,
  GrammarSummaryDto,
  KanjiEntryDto,
  SentenceDto,
} from "@/types/api";

type DictionaryRow = typeof dictionaryEntries.$inferSelect;
type KanjiRow = typeof kanjiEntries.$inferSelect;
type SentenceRow = typeof sentences.$inferSelect;
type GrammarRow = typeof grammarPatterns.$inferSelect;

export function dictionaryDto(row: DictionaryRow): DictionaryEntryDto {
  return {
    id: row.id,
    word: row.word,
    kana: row.kana,
    romaji: row.romaji,
    furigana: row.furigana,
    meanings: row.meanings,
    jlpt_level: row.jlptLevel,
    part_of_speech: row.partOfSpeech,
    pitch_accent: row.pitchAccent,
    frequency_rank: row.frequencyRank,
    kanji_ids: row.kanjiIds,
    audio_url: row.audioUrl,
    tags: row.tags,
    source: row.source,
  };
}

export function kanjiDto(row: KanjiRow): KanjiEntryDto {
  return {
    id: row.id,
    character: row.character,
    unicode: row.unicode,
    onyomi: row.onyomi,
    kunyomi: row.kunyomi,
    meanings: row.meanings,
    jlpt_level: row.jlptLevel,
    grade: row.grade,
    frequency_rank: row.frequencyRank,
    stroke_count: row.strokeCount,
    radicals: row.radicals,
    components: row.components,
    svg_animation_url: row.svgAnimationUrl,
    stroke_order_url: row.strokeOrderUrl,
    similar_kanji: row.similarKanji,
    lookalikes: row.lookalikes,
    mnemonics: row.mnemonics,
    source: row.source,
  };
}

export function sentenceDto(row: SentenceRow): SentenceDto {
  return {
    id: row.id,
    japanese: row.japanese,
    furigana_html: row.furiganaHtml,
    translations: row.translations,
    audio_url: row.audioUrl,
    jlpt_level: row.jlptLevel,
    tags: row.tags,
  };
}

export function grammarDto(row: GrammarRow): GrammarSummaryDto {
  return {
    id: row.id,
    pattern: row.pattern,
    meaning: row.meaning,
    formation: row.formation,
    jlpt_level: row.jlptLevel,
    audio_url: row.audioUrl,
  };
}

export function grammarDetailDto(row: GrammarRow): GrammarDetailDto {
  return {
    ...grammarDto(row),
    pattern_plain: row.patternPlain,
    formation_diagram: row.formationDiagram,
    examples: row.examples,
    common_mistakes: row.commonMistakes,
    related_pattern_ids: row.relatedPatternIds,
    notes: row.notes,
    tags: row.tags,
    source: row.source,
  };
}
