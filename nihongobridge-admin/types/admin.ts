export type AdminRole = "super_admin" | "content_editor" | "reviewer";
export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1" | "NONE";
export type ReviewStatus = "pending" | "approved" | "rejected" | "needs_changes";

export interface AdminIdentity {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatarUrl?: string;
}

export interface DictionaryAdminEntry {
  id: string;
  word: string;
  kana: string;
  romaji: string;
  meanings: Array<{ lang: string; value: string; pos: string }>;
  furigana: Array<{ base: string; ruby: string }>;
  pitchAccent: unknown;
  synonyms: string[];
  antonyms: string[];
  exampleSentenceIds: string[];
  grammarIds: string[];
  kanjiIds: string[];
  jlptLevel: JlptLevel;
  partOfSpeech: string[];
  frequencyRank: number | null;
  tags: string[];
  source: string;
  audioUrl: string | null;
  isActive: boolean;
  reviewStatus: ReviewStatus;
  updatedAt: string;
}

export interface KanjiAdminEntry {
  id: string;
  character: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: Array<{ lang: string; value: string }>;
  jlptLevel: JlptLevel;
  grade: number | null;
  strokeCount: number;
  frequencyRank: number | null;
  radicals: string[];
  mnemonics: Array<{ source: string; text: string }>;
  similarKanji: string[];
  svgUrl: string | null;
  audioUrl: string | null;
  reviewStatus: ReviewStatus;
}

export interface QuestionAdminEntry {
  id: string;
  sectionType: "vocabulary" | "grammar" | "reading" | "listening";
  level: Exclude<JlptLevel, "NONE">;
  source: "original" | "generated";
  difficulty: 1 | 2 | 3 | 4 | 5;
  questionJp: string;
  questionEn: string;
  options: Array<{ id: string; text_jp: string; text_en: string }>;
  correctAnswer: string;
  explanationEn: string;
  tags: string[];
  confidence: number;
  reviewStatus: ReviewStatus;
  audioUrl: string | null;
}

export interface PracticeTestAdmin {
  id: string;
  title: string;
  level: Exclude<JlptLevel, "NONE">;
  testType: "mock_full" | "section_only" | "quick_drill" | "adaptive";
  isPublished: boolean;
  questionIds: string[];
  completionRate: number;
  averageScore: number;
  attempts: number;
  updatedAt: string;
}

export interface MediaAssetAdmin {
  id: string;
  filename: string;
  fileType: "audio" | "image" | "svg" | "pdf" | "video";
  mimeType: string;
  url: string;
  sizeBytes: number;
  durationMs: number | null;
  relatedType: string | null;
  relatedId: string | null;
  voiceId: string | null;
  createdAt: string;
  used: boolean;
}

export interface PipelineRunAdmin {
  id: string;
  pipeline: "JMdict" | "KANJIDIC2" | "KanjiVG" | "Tatoeba" | "TTS" | "Questions";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  recordsImported: number;
  errorCount: number;
  logs: string[];
  schedule: string | null;
  enabled: boolean;
}

export interface BlogPostAdmin {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: Record<string, unknown>;
  html: string;
  status: "draft" | "published" | "scheduled";
  tags: string[];
  categories: string[];
  seoTitle: string;
  seoDescription: string;
  relatedContent: Array<{ type: "word" | "kanji" | "grammar" | "sentence"; id: string; label: string }>;
  scheduledFor: string | null;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  actor: AdminIdentity;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  diff: { before?: unknown; after?: unknown; changed?: string[] };
  createdAt: string;
}

export interface AdminDashboardData {
  counts: {
    words: number;
    kanji: number;
    grammar: number;
    sentences: number;
    tests: number;
    questions: number;
  };
  recentAdditions: Array<{ type: string; count: number }>;
  pendingReviews: number;
  lastPipeline: PipelineRunAdmin | null;
  weeklyChanges: Array<{ day: string; words: number; questions: number; reviews: number }>;
}
