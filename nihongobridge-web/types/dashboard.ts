import type { JlptLevel } from "@/types/test";

export interface DailyActivity {
  date: string;
  cards: number;
  tests: number;
  minutes: number;
  xp: number;
}

export interface MasteryLevel {
  level: JlptLevel;
  mastered: number;
  total: number;
  percent: number;
}

export interface TestScorePoint {
  label: string;
  score: number;
  maxScore: number;
}

export interface AccuracyPoint {
  date: string;
  accuracy: number;
}

export interface HeatmapDay {
  date: string;
  week: number;
  day: number;
  minutes: number;
  intensity: number;
}

export interface WeakAreaTag {
  id: string;
  label: string;
  type: "vocabulary" | "grammar";
  accuracy: number;
  attempts: number;
}

export interface StreakDay {
  date: string;
  studied: boolean;
  missed: boolean;
  future: boolean;
  milestone?: 7 | 30 | 100;
}

export interface ReadinessData {
  currentLevel: JlptLevel;
  targetLevel: JlptLevel;
  overall: number;
  vocabulary: number;
  kanji: number;
  grammar: number;
  tests: number;
  estimatedDays: number;
}

export interface StudyGoal {
  dailyCards: 10 | 20 | 50 | 100;
  examDate: string;
  notifications: boolean;
}

export interface DashboardData {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  streak: {
    current: number;
    longest: number;
  };
  xpTotal: number;
  xpToday: number;
  dueCards: number;
  cardsStudiedToday: number;
  dailyCardGoal: number;
  level: {
    current: JlptLevel;
    target: JlptLevel;
    readiness: number;
  };
  continueTest: {
    sessionId: string;
    title: string;
    section: number;
    sectionCount: number;
  } | null;
  recentActivity: DailyActivity[];
  mastery: {
    vocabulary: MasteryLevel[];
    kanji: MasteryLevel[];
    grammar: MasteryLevel[];
  };
  testScores: TestScorePoint[];
  accuracyTrend: AccuracyPoint[];
  heatmap: HeatmapDay[];
  weakAreas: WeakAreaTag[];
  streakCalendar: StreakDay[];
  readiness: ReadinessData;
  goal: StudyGoal;
}
