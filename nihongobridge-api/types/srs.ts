import type { HydratedContent } from "@/lib/content";

export type SrsConfidence = "again" | "hard" | "good" | "easy";
export type SrsItemType = "word" | "kanji" | "grammar" | "sentence";

export interface SrsSchedule {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  wasCorrect: boolean;
}

export interface DueSrsCard {
  id: string;
  user_id: string;
  item_type: SrsItemType;
  item_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  total_reviews: number;
  correct_count: number;
  mistake_count: number;
  average_time_ms: number;
  confidence: SrsConfidence | null;
  deck_id: string | null;
  item: HydratedContent | null;
}
