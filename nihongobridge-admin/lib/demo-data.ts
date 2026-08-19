import type {
  AdminDashboardData,
  AdminIdentity,
  BlogPostAdmin,
  DictionaryAdminEntry,
  KanjiAdminEntry,
  MediaAssetAdmin,
  PipelineRunAdmin,
  PracticeTestAdmin,
  QuestionAdminEntry,
} from "@/types/admin";

const now = "2026-08-18T12:00:00.000Z";

export const demoAdmin: AdminIdentity = {
  id: "00000000-0000-4000-8000-000000009001",
  name: "Mika Tanaka",
  email: "mika@nihongobridge.dev",
  role: "super_admin",
};

const wordSeed = [
  ["食べる", "たべる", "taberu", "to eat", "N5", "verb"],
  ["飲む", "のむ", "nomu", "to drink", "N5", "verb"],
  ["準備", "じゅんび", "junbi", "preparation", "N4", "noun"],
  ["見送る", "みおくる", "miokuru", "to see off; postpone", "N3", "verb"],
  ["受ける", "うける", "ukeru", "to receive; take", "N3", "verb"],
  ["穏やか", "おだやか", "odayaka", "calm; gentle", "N2", "adjective"],
  ["促進", "そくしん", "sokushin", "promotion; acceleration", "N1", "noun"],
  ["学生", "がくせい", "gakusei", "student", "N5", "noun"],
  ["経験", "けいけん", "keiken", "experience", "N4", "noun"],
  ["説明", "せつめい", "setsumei", "explanation", "N4", "noun"],
  ["環境", "かんきょう", "kankyou", "environment", "N3", "noun"],
  ["著しい", "いちじるしい", "ichijirushii", "remarkable", "N1", "adjective"],
] as const;

export const demoDictionary: DictionaryAdminEntry[] = wordSeed.map((item, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  word: item[0],
  kana: item[1],
  romaji: item[2],
  meanings: [{ lang: "en", value: item[3], pos: item[5] }],
  furigana: [{ base: item[0], ruby: item[1] }],
  pitchAccent: null,
  synonyms: [],
  antonyms: [],
  exampleSentenceIds: [],
  grammarIds: [],
  kanjiIds: [...item[0]].filter((character) => /[一-龯]/.test(character)),
  jlptLevel: item[4],
  partOfSpeech: [item[5]],
  frequencyRank: 120 + index * 91,
  tags: index % 2 ? ["daily-life"] : ["core", "reviewed"],
  source: index < 8 ? "jmdict" : "custom",
  audioUrl: index % 3 === 0 ? `/media/audio/word-${index}.mp3` : null,
  isActive: true,
  reviewStatus: index % 5 === 0 ? "pending" : "approved",
  updatedAt: now,
}));

const kanjiSeed = [
  ["水", "スイ", "みず", "water", "N5", 1, 4],
  ["食", "ショク", "た.べる", "eat; food", "N5", 2, 9],
  ["学", "ガク", "まな.ぶ", "study", "N5", 1, 8],
  ["準", "ジュン", "なぞら.える", "standard; semi", "N3", 5, 13],
  ["備", "ビ", "そな.える", "provide; prepare", "N3", 5, 12],
  ["環", "カン", "わ", "ring; environment", "N2", 7, 17],
  ["境", "キョウ", "さかい", "boundary", "N2", 5, 14],
  ["著", "チョ", "いちじる.しい", "notable", "N1", 6, 11],
] as const;

export const demoKanji: KanjiAdminEntry[] = kanjiSeed.map((item, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  character: item[0],
  onyomi: [item[1]],
  kunyomi: [item[2]],
  meanings: [{ lang: "en", value: item[3] }],
  jlptLevel: item[4],
  grade: item[5],
  strokeCount: item[6],
  frequencyRank: 20 + index * 120,
  radicals: [item[0]],
  mnemonics: [{ source: "custom", text: `Remember ${item[0]} through its central shape.` }],
  similarKanji: index ? [kanjiSeed[index - 1]![0]] : ["氷", "永"],
  svgUrl: index % 3 !== 1 ? `/media/svg/${item[0]}.svg` : null,
  audioUrl: index % 2 === 0 ? `/media/audio/kanji-${index}.mp3` : null,
  reviewStatus: index % 4 === 0 ? "pending" : "approved",
}));

const sections = ["vocabulary", "grammar", "reading", "listening"] as const;
export const demoQuestions: QuestionAdminEntry[] = Array.from({ length: 18 }, (_, index) => {
  const section = sections[index % sections.length]!;
  const level = (["N5", "N4", "N3", "N2", "N1"] as const)[index % 5]!;
  return {
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    sectionType: section,
    level,
    source: index % 3 ? "generated" : "original",
    difficulty: ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5,
    questionJp:
      section === "vocabulary"
        ? `「${demoDictionary[index % demoDictionary.length]!.word}」の意味を選んでください。`
        : section === "grammar"
          ? "文に入る最も適切な表現を選んでください。"
          : section === "reading"
            ? "本文の内容と合っているものを選んでください。"
            : "会話の内容として正しいものを選んでください。",
    questionEn: "Choose the most appropriate answer.",
    options: ["a", "b", "c", "d"].map((id, optionIndex) => ({
      id,
      text_jp: [`正しい答え ${index + 1}`, "ちがう答え", "別の答え", "不適切な答え"][optionIndex]!,
      text_en: "",
    })),
    correctAnswer: "a",
    explanationEn: "This item is generated from linked knowledge-base content.",
    tags: [section, "generated-batch-8"],
    confidence: index % 6 === 0 ? 0.48 : 0.82 + (index % 4) * 0.04,
    reviewStatus: index % 6 === 0 ? "pending" : index % 7 === 0 ? "needs_changes" : "approved",
    audioUrl: section === "listening" ? `/media/audio/question-${index}.mp3` : null,
  };
});

export const demoTests: PracticeTestAdmin[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    title: "N3 Original Mock Test #4",
    level: "N3",
    testType: "mock_full",
    isPublished: true,
    questionIds: demoQuestions.slice(0, 12).map((item) => item.id),
    completionRate: 78,
    averageScore: 124,
    attempts: 416,
    updatedAt: now,
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    title: "N5 Vocabulary Drill",
    level: "N5",
    testType: "section_only",
    isPublished: true,
    questionIds: demoQuestions.filter((item) => item.sectionType === "vocabulary").map((item) => item.id),
    completionRate: 91,
    averageScore: 48,
    attempts: 882,
    updatedAt: now,
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    title: "N2 Listening Pilot",
    level: "N2",
    testType: "section_only",
    isPublished: false,
    questionIds: demoQuestions.filter((item) => item.sectionType === "listening").map((item) => item.id),
    completionRate: 0,
    averageScore: 0,
    attempts: 0,
    updatedAt: now,
  },
];

const mediaKinds = ["audio", "image", "svg", "video"] as const;
export const demoMedia: MediaAssetAdmin[] = Array.from({ length: 14 }, (_, index) => {
  const fileType = mediaKinds[index % mediaKinds.length]!;
  return {
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    filename: `${fileType}-${String(index + 1).padStart(3, "0")}.${fileType === "audio" ? "mp3" : fileType === "image" ? "webp" : fileType === "svg" ? "svg" : "mp4"}`,
    fileType,
    mimeType:
      fileType === "audio"
        ? "audio/mpeg"
        : fileType === "image"
          ? "image/webp"
          : fileType === "svg"
            ? "image/svg+xml"
            : "video/mp4",
    url: `/media/${fileType}/${index + 1}`,
    sizeBytes: 24_000 + index * 41_000,
    durationMs: fileType === "audio" || fileType === "video" ? 1_800 + index * 400 : null,
    relatedType: index % 4 === 0 ? null : fileType === "svg" ? "kanji" : "sentence",
    relatedId: index % 4 === 0 ? null : demoDictionary[index % demoDictionary.length]!.id,
    voiceId: fileType === "audio" ? (index % 2 ? "ja-JP-KeitaNeural" : "ja-JP-NanamiNeural") : null,
    createdAt: now,
    used: index % 4 !== 0,
  };
});

export const demoPipelines: PipelineRunAdmin[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    pipeline: "JMdict",
    status: "completed",
    startedAt: "2026-08-17T02:00:00.000Z",
    completedAt: "2026-08-17T02:18:42.000Z",
    recordsImported: 214_778,
    errorCount: 3,
    logs: ["Downloaded JMdict_e.gz", "Parsed 214,781 entries", "Upsert complete", "Validation report written"],
    schedule: "0 2 * * 0",
    enabled: true,
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    pipeline: "Tatoeba",
    status: "running",
    startedAt: "2026-08-18T11:42:00.000Z",
    completedAt: null,
    recordsImported: 68_241,
    errorCount: 0,
    logs: ["Stage ready", "Generating furigana", "Imported batch 272/940"],
    schedule: "0 3 * * 0",
    enabled: true,
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    pipeline: "Questions",
    status: "failed",
    startedAt: "2026-08-16T04:00:00.000Z",
    completedAt: "2026-08-16T04:02:19.000Z",
    recordsImported: 118,
    errorCount: 7,
    logs: ["Generating N2 listening questions", "Quality threshold failed for 7 items", "Run stopped"],
    schedule: null,
    enabled: false,
  },
  ...(["KANJIDIC2", "KanjiVG", "TTS"] as const).map((pipeline, index) => ({
    id: `50000000-0000-4000-8000-${String(index + 4).padStart(12, "0")}`,
    pipeline,
    status: "completed" as const,
    startedAt: `2026-08-${14 - index}T02:00:00.000Z`,
    completedAt: `2026-08-${14 - index}T02:08:00.000Z`,
    recordsImported: 2_136 + index * 8_200,
    errorCount: 0,
    logs: [`${pipeline} pipeline completed successfully`],
    schedule: index < 2 ? "0 2 * * 0" : null,
    enabled: index < 2,
  })),
];

export const demoBlogPosts: BlogPostAdmin[] = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    title: "How to remember 〜わけではない",
    slug: "remember-wake-dewa-nai",
    excerpt: "A practical guide to nuance, formation, and common mistakes.",
    content: { type: "doc", content: [] },
    html: "<h2>It does not mean “never”</h2><p>This pattern gives a partial denial rather than a total one.</p>",
    status: "published",
    tags: ["grammar", "N3"],
    categories: ["Grammar guides"],
    seoTitle: "〜わけではない: Meaning and Examples",
    seoDescription: "Learn the N3 grammar pattern 〜わけではない with original examples.",
    relatedContent: [{ type: "grammar", id: "00000000-0000-4000-8000-000000002100", label: "〜わけではない" }],
    scheduledFor: null,
    updatedAt: now,
  },
  {
    id: "60000000-0000-4000-8000-000000000002",
    title: "Seven N5 verbs for breakfast",
    slug: "n5-breakfast-verbs",
    excerpt: "Build a useful morning vocabulary set.",
    content: { type: "doc", content: [] },
    html: "<p>Start with 食べる, 飲む, and 作る.</p>",
    status: "draft",
    tags: ["vocabulary", "N5"],
    categories: ["Vocabulary"],
    seoTitle: "N5 Breakfast Verbs",
    seoDescription: "Seven useful beginner Japanese verbs.",
    relatedContent: [{ type: "word", id: demoDictionary[0]!.id, label: "食べる" }],
    scheduledFor: null,
    updatedAt: now,
  },
  {
    id: "60000000-0000-4000-8000-000000000003",
    title: "December JLPT study plan",
    slug: "december-jlpt-study-plan",
    excerpt: "A twelve-week preparation schedule.",
    content: { type: "doc", content: [] },
    html: "<p>Balance SRS, timed tests, reading, and listening.</p>",
    status: "scheduled",
    tags: ["JLPT", "planning"],
    categories: ["Study plans"],
    seoTitle: "12-week JLPT Study Plan",
    seoDescription: "A balanced twelve-week JLPT preparation plan.",
    relatedContent: [],
    scheduledFor: "2026-09-01T03:00:00.000Z",
    updatedAt: now,
  },
];

export const demoDashboard: AdminDashboardData = {
  counts: {
    words: 214_778,
    kanji: 13_108,
    grammar: 824,
    sentences: 436_291,
    tests: 84,
    questions: 12_640,
  },
  recentAdditions: [
    { type: "Words", count: 1_284 },
    { type: "Kanji", count: 12 },
    { type: "Grammar", count: 18 },
    { type: "Sentences", count: 8_492 },
    { type: "Tests", count: 4 },
    { type: "Questions", count: 636 },
  ],
  pendingReviews: demoQuestions.filter((item) => item.reviewStatus === "pending").length + 18,
  lastPipeline: demoPipelines[0]!,
  weeklyChanges: [
    { day: "Mon", words: 140, questions: 34, reviews: 18 },
    { day: "Tue", words: 220, questions: 48, reviews: 21 },
    { day: "Wed", words: 164, questions: 42, reviews: 28 },
    { day: "Thu", words: 310, questions: 64, reviews: 35 },
    { day: "Fri", words: 188, questions: 58, reviews: 31 },
    { day: "Sat", words: 102, questions: 92, reviews: 44 },
    { day: "Sun", words: 160, questions: 78, reviews: 39 },
  ],
};
