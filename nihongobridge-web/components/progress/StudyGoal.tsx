"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CalendarDays, Gauge, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { saveStudyGoal } from "@/lib/dashboard-api";
import type { DashboardData, StudyGoal } from "@/types/dashboard";

const goals = [10, 20, 50, 100] as const;

export function StudyGoalSetter({
  initialGoal,
  remainingCards = 1_200,
}: {
  initialGoal: StudyGoal;
  remainingCards?: number;
}) {
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState(initialGoal);
  const [message, setMessage] = useState<string | null>(null);
  const [notificationSupported, setNotificationSupported] = useState(false);

  useEffect(() => setGoal(initialGoal), [initialGoal]);
  useEffect(() => setNotificationSupported("Notification" in window), []);

  const mutation = useMutation({
    mutationFn: saveStudyGoal,
    onMutate: async (nextGoal) => {
      setMessage(null);
      await queryClient.cancelQueries({ queryKey: ["dashboard"] });
      const previous = queryClient.getQueriesData<DashboardData>({ queryKey: ["dashboard"] });
      queryClient.setQueriesData<DashboardData>({ queryKey: ["dashboard"] }, (data) =>
        data ? { ...data, goal: nextGoal, dailyCardGoal: nextGoal.dailyCards } : data,
      );
      return { previous };
    },
    onError: (_error, _goal, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      setGoal(initialGoal);
      setMessage("Could not save this goal. Your previous settings were restored.");
    },
    onSuccess: (saved) => {
      setGoal(saved);
      setMessage("Study goal saved.");
    },
  });

  const daysRemaining = useMemo(() => {
    const target = new Date(`${goal.examDate}T23:59:59`);
    return Math.max(1, Math.ceil((target.getTime() - Date.now()) / 86_400_000));
  }, [goal.examDate]);
  const requiredPerDay = Math.ceil(remainingCards / daysRemaining);
  const selectedIndex = Math.max(0, goals.indexOf(goal.dailyCards));

  const updateNotifications = async (enabled: boolean) => {
    if (enabled && notificationSupported && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notifications were not enabled. Browser permission was not granted.");
        return;
      }
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification("NihongoBridge reminders enabled", {
            body: "We will remind you when your daily study cards are ready.",
            tag: "nihongobridge-reminder-enabled",
          });
        } catch {
          setMessage("Permission was granted, but this browser could not show a test notification.");
        }
      }
    }
    setGoal((value) => ({ ...value, notifications: enabled }));
  };

  return (
    <section className="rounded-2xl border border-sumi/10 bg-white/55 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-vermilion">Study goal</p>
        <h2 className="mt-1 text-xl font-semibold">Make the daily plan realistic</h2>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="daily-card-goal" className="flex items-center gap-2 text-sm font-semibold">
            <Gauge aria-hidden size={17} className="text-vermilion" /> Daily card goal
          </label>
          <span className="rounded-full bg-vermilion/[0.06] px-3 py-1 text-sm font-bold text-vermilion">
            {goal.dailyCards} cards
          </span>
        </div>
        <input
          id="daily-card-goal"
          type="range"
          min={0}
          max={goals.length - 1}
          step={1}
          value={selectedIndex}
          onChange={(event) =>
            setGoal((value) => ({ ...value, dailyCards: goals[Number(event.target.value)] ?? 20 }))
          }
          className="mt-4 w-full accent-vermilion"
        />
        <div className="mt-1 flex justify-between text-[0.65rem] text-sumi/40 dark:text-washi/35">
          {goals.map((value) => <span key={value}>{value}</span>)}
        </div>
      </div>

      <label className="mt-6 block text-sm font-semibold" htmlFor="exam-date">
        <span className="flex items-center gap-2"><CalendarDays aria-hidden size={17} className="text-vermilion" /> Target exam date</span>
        <input
          id="exam-date"
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          value={goal.examDate}
          onChange={(event) => setGoal((value) => ({ ...value, examDate: event.target.value }))}
          className="mt-3 h-11 w-full rounded-xl border border-sumi/10 bg-washi px-3 text-sm dark:border-white/10 dark:bg-black/20"
        />
      </label>

      <div className="mt-5 rounded-xl bg-[#F6F3EC] p-4 dark:bg-black/20">
        <p className="text-xs text-sumi/45 dark:text-washi/40">Calculated requirement</p>
        <p className="mt-1 text-lg font-bold">
          {requiredPerDay} new/review cards per day
        </p>
        <p className="mt-1 text-xs text-sumi/45 dark:text-washi/40">
          {remainingCards.toLocaleString()} estimated cards across {daysRemaining} days.
        </p>
        {requiredPerDay > goal.dailyCards ? (
          <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
            Your selected goal is below the estimated pace. Increase it gradually or move the date.
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-sumi/10 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-3">
          {goal.notifications ? <Bell aria-hidden size={18} className="text-vermilion" /> : <BellOff aria-hidden size={18} className="text-sumi/35" />}
          <div>
            <p className="text-sm font-semibold">Push reminders</p>
            <p className="text-xs text-sumi/40 dark:text-washi/35">
              {notificationSupported ? "Daily PWA study reminder" : "Not supported by this browser"}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={goal.notifications}
          disabled={!notificationSupported}
          onClick={() => void updateNotifications(!goal.notifications)}
          className={`relative h-7 w-12 rounded-full transition disabled:opacity-35 ${goal.notifications ? "bg-vermilion" : "bg-sumi/15 dark:bg-white/20"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${goal.notifications ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(goal)}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-washi disabled:opacity-50 dark:bg-washi dark:text-[#141412]"
      >
        <Save aria-hidden size={16} /> {mutation.isPending ? "Saving…" : "Save goal"}
      </button>
      {message ? <p className="mt-3 text-center text-xs text-sumi/50 dark:text-washi/45" aria-live="polite">{message}</p> : null}
    </section>
  );
}

export function StudyGoalSkeleton() {
  return <div className="h-[39rem] animate-pulse rounded-2xl bg-sumi/5 dark:bg-white/5" aria-label="Loading study goal" />;
}
