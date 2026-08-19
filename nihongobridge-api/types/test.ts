export type TestLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type TestSectionType = "vocabulary" | "grammar" | "reading" | "listening";
export type RequestedTestType = "full_mock" | "section_drill";

export interface TestOption {
  id: string;
  text_jp: string;
  text_en: string;
}

export interface PublicTestQuestion {
  id: string;
  section_type: TestSectionType;
  question_jp: string | null;
  question_en: string | null;
  stimulus: Record<string, unknown> | null;
  options: TestOption[];
  audio_url: string | null;
  image_url: string | null;
  difficulty: number;
  jlpt_level: string;
  time_limit_seconds: number | null;
  tags: string[];
}

export interface TestSectionState {
  type: TestSectionType;
  time_minutes: number;
  question_ids: string[];
}

export interface SessionAnswer {
  question_id: string;
  selected: string;
  time_taken_ms: number;
  answered_at: string;
}

export interface TestSessionState {
  version: 1;
  session_id: string;
  test_id: string;
  user_id: string;
  level: TestLevel;
  test_type: RequestedTestType;
  sections: TestSectionState[];
  questions: PublicTestQuestion[];
  current_index: number;
  answers: Record<string, SessionAnswer>;
  started_at: string;
  deadline_at: string;
  status: "active" | "completed";
  completed_at?: string;
}

export interface StartTestResponse {
  session_id: string;
  test_id: string;
  sections: TestSectionState[];
  first_question: PublicTestQuestion | null;
  time_remaining_seconds: number;
}

export interface SessionStatusResponse {
  session_id: string;
  test_id: string;
  level: TestLevel;
  test_type: RequestedTestType;
  sections: TestSectionState[];
  status: "active" | "completed" | "expired";
  current_question: PublicTestQuestion | null;
  current_question_number: number;
  total_questions: number;
  answers_so_far: SessionAnswer[];
  time_elapsed: number;
  time_remaining: number;
}

export interface AnswerTestResponse {
  next_question?: PublicTestQuestion;
  section_complete: boolean;
  test_complete: boolean;
  time_remaining: number;
}

export interface ScoreSection {
  score: number;
  max_score: number;
  correct: number;
  total: number;
  minimum_required: number;
  minimum_met: boolean;
}

export interface TestScoreResult {
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
}

export interface CompleteTestResponse extends TestScoreResult {
  time_spent: number;
  xp_earned: number;
  review_url: string;
}

export interface ReviewQuestion extends PublicTestQuestion {
  correct_answer: string;
  explanation_jp: string | null;
  explanation_en: string | null;
  user_answer: string | null;
  is_correct: boolean;
  vocabulary: Array<{
    id: string;
    word: string;
    kana: string | null;
    meanings: Array<{ lang: string; value: string; pos: string }>;
  }>;
  grammar: Array<{
    id: string;
    pattern: string;
    meaning: Array<{ lang: string; value: string }>;
  }>;
}

export interface DialogueLine {
  speaker?: string | undefined;
  text: string;
}

export interface VoiceConfig {
  female_voice?: string | undefined;
  male_voice?: string | undefined;
  rate?: string | undefined;
  volume?: string | undefined;
}
