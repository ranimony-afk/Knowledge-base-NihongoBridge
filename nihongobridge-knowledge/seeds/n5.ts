import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { dictionaryEntries } from "../schema/dictionary.js";
import { grammarPatterns } from "../schema/grammar.js";
import { kanjiEntries } from "../schema/kanji.js";
import {
  dictionaryKanjiLinks,
  questionGrammarLinks,
  questionVocabularyLinks,
} from "../schema/relations.js";
import * as schema from "../schema/index.js";
import { questions } from "../schema/tests.js";
import type {
  NewDictionaryEntry,
  NewGrammarPattern,
  NewKanjiEntry,
  NewQuestion,
} from "../schema/index.js";

export const N5_SEED_IDS = {
  words: {
    taberu: "00000000-0000-4000-8000-000000000001",
    nomu: "00000000-0000-4000-8000-000000000002",
    mizu: "00000000-0000-4000-8000-000000000003",
    gakusei: "00000000-0000-4000-8000-000000000004",
    nihon: "00000000-0000-4000-8000-000000000005",
  },
  kanji: {
    nichi: "00000000-0000-4000-8000-000000001001",
    hon: "00000000-0000-4000-8000-000000001002",
    mizu: "00000000-0000-4000-8000-000000001003",
    shoku: "00000000-0000-4000-8000-000000001004",
    gaku: "00000000-0000-4000-8000-000000001005",
  },
  grammar: {
    desu: "00000000-0000-4000-8000-000000002001",
    masu: "00000000-0000-4000-8000-000000002002",
    teKudasai: "00000000-0000-4000-8000-000000002003",
  },
  questions: {
    mizuReading: "00000000-0000-4000-8000-000000003001",
    desuCompletion: "00000000-0000-4000-8000-000000003002",
  },
} as const;

export const n5Words = [
  {
    id: N5_SEED_IDS.words.taberu,
    word: "食べる",
    kana: "たべる",
    romaji: "taberu",
    furigana: [
      { base: "食", ruby: "た" },
      { base: "べる", ruby: "" },
    ],
    meanings: [{ lang: "en", value: "to eat", pos: "verb (ichidan)" }],
    jlptLevel: "N5",
    partOfSpeech: ["verb", "ichidan verb"],
    frequencyRank: 530,
    kanjiIds: ["食"],
    tags: ["food", "daily-life", "n5-seed"],
    source: "custom",
    sourceId: "seed-n5-taberu",
  },
  {
    id: N5_SEED_IDS.words.nomu,
    word: "飲む",
    kana: "のむ",
    romaji: "nomu",
    furigana: [
      { base: "飲", ruby: "の" },
      { base: "む", ruby: "" },
    ],
    meanings: [{ lang: "en", value: "to drink", pos: "verb (godan)" }],
    jlptLevel: "N5",
    partOfSpeech: ["verb", "godan verb"],
    frequencyRank: 820,
    kanjiIds: ["飲"],
    tags: ["food", "daily-life", "n5-seed"],
    source: "custom",
    sourceId: "seed-n5-nomu",
  },
  {
    id: N5_SEED_IDS.words.mizu,
    word: "水",
    kana: "みず",
    romaji: "mizu",
    furigana: [{ base: "水", ruby: "みず" }],
    meanings: [{ lang: "en", value: "water", pos: "noun" }],
    jlptLevel: "N5",
    partOfSpeech: ["noun"],
    frequencyRank: 310,
    kanjiIds: ["水"],
    tags: ["nature", "daily-life", "n5-seed"],
    source: "custom",
    sourceId: "seed-n5-mizu",
  },
  {
    id: N5_SEED_IDS.words.gakusei,
    word: "学生",
    kana: "がくせい",
    romaji: "gakusei",
    furigana: [
      { base: "学", ruby: "がく" },
      { base: "生", ruby: "せい" },
    ],
    meanings: [{ lang: "en", value: "student", pos: "noun" }],
    jlptLevel: "N5",
    partOfSpeech: ["noun"],
    frequencyRank: 690,
    kanjiIds: ["学", "生"],
    tags: ["people", "school", "n5-seed"],
    source: "custom",
    sourceId: "seed-n5-gakusei",
  },
  {
    id: N5_SEED_IDS.words.nihon,
    word: "日本",
    kana: "にほん",
    romaji: "nihon",
    furigana: [
      { base: "日", ruby: "に" },
      { base: "本", ruby: "ほん" },
    ],
    meanings: [{ lang: "en", value: "Japan", pos: "proper noun" }],
    jlptLevel: "N5",
    partOfSpeech: ["proper noun"],
    frequencyRank: 40,
    kanjiIds: ["日", "本"],
    tags: ["country", "place", "n5-seed"],
    source: "custom",
    sourceId: "seed-n5-nihon",
  },
] satisfies NewDictionaryEntry[];

export const n5Kanji = [
  {
    id: N5_SEED_IDS.kanji.nichi,
    character: "日",
    unicode: "U+65E5",
    onyomi: ["ニチ", "ジツ"],
    kunyomi: ["ひ", "か"],
    meanings: [{ lang: "en", value: "day; sun" }],
    jlptLevel: "N5",
    grade: 1,
    frequencyRank: 1,
    strokeCount: 4,
    radicals: ["日"],
    components: ["日"],
    exampleWordIds: [N5_SEED_IDS.words.nihon],
    mnemonics: [{ source: "custom", text: "A square sun with a bright center." }],
    source: "kanjidic2",
  },
  {
    id: N5_SEED_IDS.kanji.hon,
    character: "本",
    unicode: "U+672C",
    onyomi: ["ホン"],
    kunyomi: ["もと"],
    meanings: [{ lang: "en", value: "book; origin" }],
    jlptLevel: "N5",
    grade: 1,
    frequencyRank: 10,
    strokeCount: 5,
    radicals: ["木"],
    components: ["木", "一"],
    exampleWordIds: [N5_SEED_IDS.words.nihon],
    mnemonics: [{ source: "custom", text: "A mark at the root of a tree shows its origin." }],
    source: "kanjidic2",
  },
  {
    id: N5_SEED_IDS.kanji.mizu,
    character: "水",
    unicode: "U+6C34",
    onyomi: ["スイ"],
    kunyomi: ["みず"],
    meanings: [{ lang: "en", value: "water" }],
    jlptLevel: "N5",
    grade: 1,
    frequencyRank: 223,
    strokeCount: 4,
    radicals: ["水"],
    components: ["水"],
    exampleWordIds: [N5_SEED_IDS.words.mizu],
    mnemonics: [{ source: "custom", text: "A central stream with drops flowing on both sides." }],
    source: "kanjidic2",
  },
  {
    id: N5_SEED_IDS.kanji.shoku,
    character: "食",
    unicode: "U+98DF",
    onyomi: ["ショク"],
    kunyomi: ["た.べる", "く.う"],
    meanings: [{ lang: "en", value: "eat; food" }],
    jlptLevel: "N5",
    grade: 2,
    frequencyRank: 328,
    strokeCount: 9,
    radicals: ["食"],
    components: ["人", "良"],
    exampleWordIds: [N5_SEED_IDS.words.taberu],
    mnemonics: [{ source: "custom", text: "A person gathers good food under a lid." }],
    source: "kanjidic2",
  },
  {
    id: N5_SEED_IDS.kanji.gaku,
    character: "学",
    unicode: "U+5B66",
    onyomi: ["ガク"],
    kunyomi: ["まな.ぶ"],
    meanings: [{ lang: "en", value: "study; learning" }],
    jlptLevel: "N5",
    grade: 1,
    frequencyRank: 63,
    strokeCount: 8,
    radicals: ["子"],
    components: ["⺍", "冖", "子"],
    exampleWordIds: [N5_SEED_IDS.words.gakusei],
    mnemonics: [{ source: "custom", text: "A child learns under a school roof." }],
    source: "kanjidic2",
  },
] satisfies NewKanjiEntry[];

export const n5GrammarPatterns = [
  {
    id: N5_SEED_IDS.grammar.desu,
    pattern: "〜です",
    patternPlain: "desu",
    meaning: [{ lang: "en", value: "to be; polite sentence ending" }],
    formation: "Noun / な-adjective + です",
    jlptLevel: "N5",
    examples: [
      {
        jp: "私は学生です。",
        reading: "わたしはがくせいです。",
        translations: [{ lang: "en", value: "I am a student." }],
      },
    ],
    commonMistakes: "Do not use です directly after a plain-form verb.",
    tags: ["copula", "polite", "n5-seed"],
    source: "custom",
  },
  {
    id: N5_SEED_IDS.grammar.masu,
    pattern: "〜ます",
    patternPlain: "masu",
    meaning: [{ lang: "en", value: "polite non-past verb ending" }],
    formation: "Verb ます-stem + ます",
    jlptLevel: "N5",
    examples: [
      {
        jp: "毎日日本語を勉強します。",
        reading: "まいにちにほんごをべんきょうします。",
        translations: [{ lang: "en", value: "I study Japanese every day." }],
      },
    ],
    commonMistakes: "Attach ます to the verb stem, not to the dictionary form.",
    tags: ["verb", "polite", "n5-seed"],
    source: "custom",
  },
  {
    id: N5_SEED_IDS.grammar.teKudasai,
    pattern: "〜てください",
    patternPlain: "te kudasai",
    meaning: [{ lang: "en", value: "please do ..." }],
    formation: "Verb て-form + ください",
    jlptLevel: "N5",
    examples: [
      {
        jp: "ここに名前を書いてください。",
        reading: "ここになまえをかいてください。",
        translations: [{ lang: "en", value: "Please write your name here." }],
      },
    ],
    commonMistakes: "Use the て-form before ください.",
    tags: ["request", "te-form", "n5-seed"],
    source: "custom",
  },
] satisfies NewGrammarPattern[];

export const n5Questions = [
  {
    id: N5_SEED_IDS.questions.mizuReading,
    testId: null,
    sectionType: "vocabulary",
    questionJp: "「水」の読み方を選んでください。",
    questionEn: "Choose the correct reading for 水.",
    options: [
      { id: "a", text_jp: "ひ", text_en: "hi" },
      { id: "b", text_jp: "みず", text_en: "mizu" },
      { id: "c", text_jp: "き", text_en: "ki" },
      { id: "d", text_jp: "ほん", text_en: "hon" },
    ],
    correctAnswer: "b",
    explanationJp: "「水」は「みず」と読みます。",
    explanationEn: "水 is read みず and means “water.”",
    vocabularyIds: [N5_SEED_IDS.words.mizu],
    difficulty: 1,
    jlptLevel: "N5",
    timeLimitSeconds: 30,
    tags: ["reading-selection", "n5-seed"],
    source: "original",
    isActive: true,
  },
  {
    id: N5_SEED_IDS.questions.desuCompletion,
    testId: null,
    sectionType: "grammar",
    questionJp: "私は学生___。",
    questionEn: "Choose the correct polite sentence ending.",
    options: [
      { id: "a", text_jp: "ます", text_en: "masu" },
      { id: "b", text_jp: "です", text_en: "desu" },
      { id: "c", text_jp: "ください", text_en: "kudasai" },
      { id: "d", text_jp: "でしたか", text_en: "deshita ka" },
    ],
    correctAnswer: "b",
    explanationJp: "名詞「学生」の後には、丁寧なコピュラ「です」を使います。",
    explanationEn: "Use the polite copula です after the noun 学生.",
    vocabularyIds: [N5_SEED_IDS.words.gakusei],
    grammarIds: [N5_SEED_IDS.grammar.desu],
    difficulty: 1,
    jlptLevel: "N5",
    timeLimitSeconds: 30,
    tags: ["sentence-completion", "copula", "n5-seed"],
    source: "original",
    isActive: true,
  },
] satisfies NewQuestion[];

/** Idempotently inserts the small N5 development fixture and normalized links. */
export async function seedN5(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(kanjiEntries).values(n5Kanji).onConflictDoNothing();
    await tx.insert(dictionaryEntries).values(n5Words).onConflictDoNothing();
    await tx.insert(grammarPatterns).values(n5GrammarPatterns).onConflictDoNothing();
    await tx.insert(questions).values(n5Questions).onConflictDoNothing();

    await tx
      .insert(dictionaryKanjiLinks)
      .values([
        {
          dictionaryEntryId: N5_SEED_IDS.words.taberu,
          kanjiEntryId: N5_SEED_IDS.kanji.shoku,
          exampleRank: 1,
        },
        {
          dictionaryEntryId: N5_SEED_IDS.words.mizu,
          kanjiEntryId: N5_SEED_IDS.kanji.mizu,
          exampleRank: 1,
        },
        {
          dictionaryEntryId: N5_SEED_IDS.words.gakusei,
          kanjiEntryId: N5_SEED_IDS.kanji.gaku,
          exampleRank: 1,
        },
        {
          dictionaryEntryId: N5_SEED_IDS.words.nihon,
          kanjiEntryId: N5_SEED_IDS.kanji.nichi,
          exampleRank: 1,
        },
        {
          dictionaryEntryId: N5_SEED_IDS.words.nihon,
          kanjiEntryId: N5_SEED_IDS.kanji.hon,
          exampleRank: 1,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(questionVocabularyLinks)
      .values([
        {
          questionId: N5_SEED_IDS.questions.mizuReading,
          dictionaryEntryId: N5_SEED_IDS.words.mizu,
        },
        {
          questionId: N5_SEED_IDS.questions.desuCompletion,
          dictionaryEntryId: N5_SEED_IDS.words.gakusei,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(questionGrammarLinks)
      .values({
        questionId: N5_SEED_IDS.questions.desuCompletion,
        grammarPatternId: N5_SEED_IDS.grammar.desu,
      })
      .onConflictDoNothing();
  });
}
