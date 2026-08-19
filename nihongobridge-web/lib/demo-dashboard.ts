import type {
  AccuracyPoint,
  DashboardData,
  DailyActivity,
  HeatmapDay,
  StreakDay,
} from "@/types/dashboard";

const TODAY = new Date(2026, 7, 18);

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function recentActivity(): DailyActivity[] {
  const cards = [18, 20, 16, 0, 24, 12, 12];
  return cards.map((count, index) => {
    const date = new Date(TODAY);
    date.setDate(TODAY.getDate() - (6 - index));
    return {
      date: iso(date),
      cards: count,
      tests: index === 1 || index === 5 ? 1 : 0,
      minutes: count ? 18 + count * 2 : 0,
      xp: count ? count * 20 + (index === 5 ? 100 : 0) : 0,
    };
  });
}

function accuracyTrend(): AccuracyPoint[] {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(TODAY);
    date.setDate(TODAY.getDate() - (29 - index));
    const wave = Math.sin(index / 3.1) * 5;
    return {
      date: iso(date),
      accuracy: Math.max(58, Math.min(91, Math.round(66 + index * 0.55 + wave))),
    };
  });
}

function heatmap(): HeatmapDay[] {
  return Array.from({ length: 91 }, (_, index) => {
    const date = new Date(TODAY);
    date.setDate(TODAY.getDate() - (90 - index));
    const minutes = index % 11 === 0 ? 0 : 12 + ((index * 17) % 64);
    return {
      date: iso(date),
      week: Math.floor(index / 7),
      day: index % 7,
      minutes,
      intensity: minutes === 0 ? 0 : Math.min(4, Math.ceil(minutes / 18)),
    };
  });
}

function streakCalendar(): StreakDay[] {
  return Array.from({ length: 31 }, (_, index) => {
    const date = new Date(2026, 7, index + 1);
    const future = date > TODAY;
    const studied = !future;
    return {
      date: iso(date),
      studied,
      missed: false,
      future,
      ...(index === 1 ? { milestone: 7 as const } : {}),
    };
  });
}

export const demoDashboard: DashboardData = {
  user: {
    id: "demo-user",
    name: "Aiko",
    avatarUrl: null,
  },
  streak: { current: 23, longest: 41 },
  xpTotal: 18_460,
  xpToday: 580,
  dueCards: 24,
  cardsStudiedToday: 12,
  dailyCardGoal: 20,
  level: {
    current: "N4",
    target: "N3",
    readiness: 68,
  },
  continueTest: {
    sessionId: "demo",
    title: "N3 Mock Test",
    section: 2,
    sectionCount: 4,
  },
  recentActivity: recentActivity(),
  mastery: {
    vocabulary: [
      { level: "N5", mastered: 710, total: 800, percent: 89 },
      { level: "N4", mastered: 980, total: 1_500, percent: 65 },
      { level: "N3", mastered: 520, total: 3_000, percent: 17 },
      { level: "N2", mastered: 90, total: 6_000, percent: 2 },
      { level: "N1", mastered: 18, total: 10_000, percent: 0 },
    ],
    kanji: [
      { level: "N5", mastered: 96, total: 103, percent: 93 },
      { level: "N4", mastered: 142, total: 181, percent: 78 },
      { level: "N3", mastered: 210, total: 370, percent: 57 },
      { level: "N2", mastered: 44, total: 374, percent: 12 },
      { level: "N1", mastered: 8, total: 1_232, percent: 1 },
    ],
    grammar: [
      { level: "N5", mastered: 74, total: 80, percent: 93 },
      { level: "N4", mastered: 93, total: 120, percent: 78 },
      { level: "N3", mastered: 88, total: 180, percent: 49 },
      { level: "N2", mastered: 20, total: 200, percent: 10 },
      { level: "N1", mastered: 4, total: 220, percent: 2 },
    ],
  },
  testScores: [91, 104, 112, 108, 119, 126, 121, 134, 139, 142].map((score, index) => ({
    label: `T${index + 1}`,
    score,
    maxScore: 180,
  })),
  accuracyTrend: accuracyTrend(),
  heatmap: heatmap(),
  weakAreas: [
    { id: "wa-1", label: "〜わけではない", type: "grammar", accuracy: 42, attempts: 12 },
    { id: "wa-2", label: "受ける", type: "vocabulary", accuracy: 48, attempts: 9 },
    { id: "wa-3", label: "〜に違いない", type: "grammar", accuracy: 53, attempts: 8 },
    { id: "wa-4", label: "見送る", type: "vocabulary", accuracy: 58, attempts: 7 },
    { id: "wa-5", label: "〜ものの", type: "grammar", accuracy: 59, attempts: 10 },
  ],
  streakCalendar: streakCalendar(),
  readiness: {
    currentLevel: "N4",
    targetLevel: "N3",
    overall: 68,
    vocabulary: 61,
    kanji: 74,
    grammar: 66,
    tests: 72,
    estimatedDays: 47,
  },
  goal: {
    dailyCards: 20,
    examDate: "2026-12-06",
    notifications: false,
  },
};
