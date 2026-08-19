import { apiRequest, currentUserId } from "@/lib/api-client";
import { demoDashboard } from "@/lib/demo-dashboard";
import type { ApiEnvelope } from "@/types/test";
import type {
  DashboardData,
  HeatmapDay,
  MasteryLevel,
  StudyGoal,
} from "@/types/dashboard";

interface DashboardApiData {
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  streak: number;
  xp: number;
  level: { current: string; target: string };
  due_cards_count: number;
  recent_test_scores: Array<{
    session_id: string;
    title: string;
    level: string;
    score: number | null;
    passed: boolean | null;
    completed_at: string;
  }>;
  bookmarks_count: number;
  recent_activity: Array<{
    date: string;
    srs_reviews: number;
    tests_completed: number;
  }>;
  recommended_next_study: string;
}

interface SrsStatsApiData {
  due_today: number;
  studied_today: number;
  mastered_total: number;
  streak: number;
  accuracy_30d: number;
}

interface AnalyticsApiData {
  accuracy_by_level: Record<string, { correct: number; total: number; accuracy: number }>;
  accuracy_by_section: Record<string, { correct: number; total: number; accuracy: number }>;
  streak: number;
  weak_areas: Array<{ type: string; correct: number; attempts: number; accuracy: number }>;
  recommended_next_study: string;
  attempts_analyzed: number;
}

export async function fetchDashboardData(demo = false): Promise<DashboardData> {
  if (demo) {
    await new Promise((resolve) => setTimeout(resolve, 260));
    return structuredClone(demoDashboard);
  }
  const userId = currentUserId();
  if (!userId) throw new Error("Sign in to view your dashboard.");
  const [dashboardEnvelope, srsEnvelope, analyticsEnvelope] = await Promise.all([
    apiRequest<ApiEnvelope<DashboardApiData>>(`/api/user/${userId}/dashboard`, { method: "GET" }),
    apiRequest<ApiEnvelope<SrsStatsApiData>>(`/api/srs/stats/${userId}`, { method: "GET" }),
    apiRequest<ApiEnvelope<AnalyticsApiData>>(`/api/tests/analytics/${userId}`, { method: "GET" }),
  ]);
  const dashboard = dashboardEnvelope.data;
  const srs = srsEnvelope.data;
  const analytics = analyticsEnvelope.data;
  const activity = dashboard.recent_activity.map((day) => ({
    date: day.date,
    cards: day.srs_reviews,
    tests: day.tests_completed,
    minutes: day.srs_reviews * 2 + day.tests_completed * 40,
    xp: day.srs_reviews * 2 + day.tests_completed * 10,
  }));
  const goal = loadStudyGoal();
  const mastery = emptyMastery(srs.mastered_total);
  const heatmap = emptyHeatmap(activity);
  const scores = dashboard.recent_test_scores
    .slice()
    .reverse()
    .map((item, index) => ({
      label: `T${index + 1}`,
      score: item.score ?? 0,
      maxScore: 180,
    }));
  const readinessPercent = Math.round(
    Object.values(analytics.accuracy_by_section).reduce((sum, item) => sum + item.accuracy, 0) /
      Math.max(1, Object.keys(analytics.accuracy_by_section).length),
  );
  const currentLevel = asLevel(dashboard.level.current, "N5");
  const targetLevel = asLevel(dashboard.level.target, "N5");

  return {
    user: {
      id: dashboard.user.id,
      name: dashboard.user.display_name ?? dashboard.user.username,
      avatarUrl: dashboard.user.avatar_url,
    },
    streak: { current: dashboard.streak, longest: dashboard.streak },
    xpTotal: dashboard.xp,
    xpToday: activity.at(-1)?.xp ?? 0,
    dueCards: dashboard.due_cards_count,
    cardsStudiedToday: srs.studied_today,
    dailyCardGoal: goal.dailyCards,
    level: {
      current: currentLevel,
      target: targetLevel,
      readiness: readinessPercent,
    },
    continueTest: null,
    recentActivity: activity,
    mastery,
    testScores: scores,
    accuracyTrend: activity.map((item) => ({ date: item.date, accuracy: srs.accuracy_30d })),
    heatmap,
    weakAreas: analytics.weak_areas.map((item, index) => ({
      id: `${item.type}-${index}`,
      label: item.type,
      type: item.type.includes("grammar") ? "grammar" : "vocabulary",
      accuracy: item.accuracy,
      attempts: item.attempts,
    })),
    streakCalendar: activity.map((item) => ({
      date: item.date,
      studied: item.cards > 0 || item.tests > 0,
      missed: item.cards === 0 && item.tests === 0,
      future: false,
    })),
    readiness: {
      currentLevel,
      targetLevel,
      overall: readinessPercent,
      vocabulary: analytics.accuracy_by_section.vocabulary?.accuracy ?? 0,
      kanji: 0,
      grammar: analytics.accuracy_by_section.grammar?.accuracy ?? 0,
      tests: readinessPercent,
      estimatedDays: Math.max(14, Math.ceil((100 - readinessPercent) * 1.5)),
    },
    goal,
  };
}

export function loadStudyGoal(): StudyGoal {
  if (typeof window === "undefined") {
    return { dailyCards: 20, examDate: "2026-12-06", notifications: false };
  }
  try {
    const value = window.localStorage.getItem("nihongobridge:study-goal");
    if (!value) throw new Error("missing");
    return JSON.parse(value) as StudyGoal;
  } catch {
    return { dailyCards: 20, examDate: "2026-12-06", notifications: false };
  }
}

export async function saveStudyGoal(goal: StudyGoal): Promise<StudyGoal> {
  await new Promise((resolve) => setTimeout(resolve, 240));
  window.localStorage.setItem("nihongobridge:study-goal", JSON.stringify(goal));
  return goal;
}

function emptyMastery(masteredTotal: number): DashboardData["mastery"] {
  const levels: DashboardData["level"]["current"][] = ["N5", "N4", "N3", "N2", "N1"];
  const make = (factor: number): MasteryLevel[] =>
    levels.map((level, index) => {
      const total = [800, 1_500, 3_000, 6_000, 10_000][index]!;
      const mastered = Math.min(total, Math.round((masteredTotal * factor) / (index + 1)));
      return { level, total, mastered, percent: Math.round((mastered / total) * 100) };
    });
  return { vocabulary: make(0.65), kanji: make(0.22), grammar: make(0.13) };
}

function asLevel(value: string, fallback: DashboardData["level"]["current"]): DashboardData["level"]["current"] {
  return value === "N1" || value === "N2" || value === "N3" || value === "N4" || value === "N5"
    ? value
    : fallback;
}

function emptyHeatmap(activity: DashboardData["recentActivity"]): HeatmapDay[] {
  const activityMap = new Map(activity.map((item) => [item.date, item.minutes]));
  const today = new Date();
  return Array.from({ length: 91 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (90 - index));
    const key = date.toISOString().slice(0, 10);
    const minutes = activityMap.get(key) ?? 0;
    return {
      date: key,
      week: Math.floor(index / 7),
      day: index % 7,
      minutes,
      intensity: minutes ? Math.min(4, Math.ceil(minutes / 18)) : 0,
    };
  });
}
