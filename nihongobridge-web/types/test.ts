export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type TestType = "full_mock" | "section_drill";
export type SectionType = "vocabulary" | "grammar" | "reading" | "listening";

export interface TestOption {
  id: string;
  text_jp: string;
  text_en: string;
}

export interface SpeakerInfo {
  id?: string;
  name?: string;
  gender?: string;
}

export interface TranscriptLine {
  speaker?: string;
  text: string;
}

export interface QuestionStimulus extends Record<string, unknown> {
  passage?: string;
  passage_html?: string;
  audio_url?: string;
  transcript?: TranscriptLine[];
  transcript_review_only?: boolean;
  speakers?: SpeakerInfo[];
  voices?: string[];
  replay_limit?: number;
}

export interface TestQuestion {
  id: string;
  section_type: SectionType;
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
}

export interface TestSection {
  type: SectionType;
  time_minutes: number;
  question_ids: string[];
}

export interface SessionAnswer {
  question_id: string;
  selected: string;
  time_taken_ms: number;
  answered_at: string;
}

export interface SessionStatus {
  session_id: string;
  test_id: string;
  level: JlptLevel;
  test_type: TestType;
  sections: TestSection[];
  status: "active" | "completed" | "expired";
  current_question: TestQuestion | null;
  current_question_number: number;
  total_questions: number;
  answers_so_far: SessionAnswer[];
  time_elapsed: number;
  time_remaining: number;
}

export interface AnswerResponse {
  next_question?: TestQuestion;
  section_complete: boolean;
  test_complete: boolean;
  time_remaining: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: { page: number; limit: number; total: number };
  error?: string;
}

export interface LocalSessionSnapshot {
  version: 1;
  sessionId: string;
  answers: Record<string, SessionAnswer>;
  flaggedQuestionIds: string[];
  currentQuestionIndex: number;
  timeElapsed: number;
  savedAt: string;
}
