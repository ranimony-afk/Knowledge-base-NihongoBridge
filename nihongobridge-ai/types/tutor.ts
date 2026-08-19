export const TUTOR_LANGUAGES = ["en", "ta", "ml", "hi"] as const;
export type TutorLanguage = (typeof TUTOR_LANGUAGES)[number];

export type TutorRole = "user" | "assistant";

export interface TutorMessage {
  role: TutorRole;
  content: string;
}

export interface TutorContext {
  current_level: "N5" | "N4" | "N3" | "N2" | "N1";
  recent_mistakes: string[];
  current_topic?: string | undefined;
  language_preference: TutorLanguage;
}

export interface TutorChatRequest {
  message: string;
  context: TutorContext;
  conversation_history: TutorMessage[];
}

export interface GrammarExampleExplanation {
  japanese: string;
  reading: string;
  translation_en: string;
}

export interface GrammarExplanation {
  explanation_jp: string;
  explanation_en: string;
  original_examples: GrammarExampleExplanation[];
  common_mistakes: string[];
}

export interface TranslationBreakdownItem {
  japanese: string;
  reading: string | null;
  meaning: string;
  grammar_note: string | null;
}

export interface TranslationResult {
  translation: string;
  source_lang: "ja" | "en" | "ta" | "ml" | "hi";
  target_lang: "ja" | "en" | "ta" | "ml" | "hi";
  breakdown: TranslationBreakdownItem[] | null;
}

export interface GeneratedQuestionResult {
  ids: string[];
  count: number;
  status: "draft";
  provenance: {
    kind: "knowledge-base-synthesis";
    copyrighted_exam_content: false;
  };
}
