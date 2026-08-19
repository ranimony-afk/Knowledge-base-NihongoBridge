import type {
  JlptLevel,
  QuestionStimulus,
  TestOption,
  TestSection,
  TestType,
} from "@/types/test";

export interface ScoreSection {
  score: number;
  max_score: number;
  correct: number;
  total: number;
  minimum_required: number;
  minimum_met: boolean;
}

export interface CompleteResult {
  score_total: number;
  score_by_section: {
    vocabulary: ScoreSection;
    grammar_reading: ScoreSection;
    listening: ScoreSection;
  };
  passed: boolean;
  accuracy: number;
  correct_answers: number;
  total_questions: number;
  time_spent: number;
  xp_earned: number;
  review_url: string;
}

export interface ReviewVocabulary {
  id: string;
  word: string;
  kana: string | null;
  meanings: Array<{ lang: string; value: string; pos: string }>;
}

export interface ReviewGrammar {
  id: string;
  pattern: string;
  meaning: Array<{ lang: string; value: string }>;
}

export interface ReviewQuestion {
  id: string;
  section_type: "vocabulary" | "grammar" | "reading" | "listening";
  question_jp: string | null;
  question_en: string | null;
  stimulus: QuestionStimulus | null;
  options: TestOption[];
  audio_url: string | null;
  image_url: string | null;
  difficulty: number;
  jlpt_level: string;
  time_limit_seconds: number | null;
  tags: string[];
  correct_answer: string;
  explanation_jp: string | null;
  explanation_en: string | null;
  user_answer: string | null;
  is_correct: boolean;
  vocabulary: ReviewVocabulary[];
  grammar: ReviewGrammar[];
}

export interface TestReviewData {
  session_id: string;
  test_id: string;
  score_total: number | null;
  score_by_section: CompleteResult["score_by_section"] | null;
  passed: boolean | null;
  sections: TestSection[];
  questions: ReviewQuestion[];
}

export interface ResultPageData {
  result: CompleteResult;
  review: TestReviewData;
  level: JlptLevel;
  testType: TestType;
  totalTimeSeconds: number;
}

export interface WeakArea {
  id: string;
  type: "word" | "grammar";
  label: string;
  misses: number;
}

export type ReviewFilter = "all" | "correct" | "incorrect" | "flagged";
