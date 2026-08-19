"use client";

import { CalendarDays, Flame } from "lucide-react";

import type { StreakDay } from "@/types/dashboard";

interface StreakCalendarProps {
  days: StreakDay[];
  currentStreak: number;
  longestStreak: number;
}

export function StreakCalendar({
  days,
  currentStreak,
  longestStreak,
}: StreakCalendarProps) {
  const anchor = days[0] ? new Date(`${days[0].date}T12:00:00`) : new Date();
  const monthName = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(anchor);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();
  const byDate = new Map(days.map((day) => [day.date, day]));
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(year, month, index + 1);
      const key = localIso(date);
      return byDate.get(key) ?? {
        date: key,
        studied: false,
        missed: date < new Date(),
        future: date > new Date(),
      };
    }),
  ];

  return (
    <section className="rounded-2xl border border-sumi/10 bg-white/55 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-vermilion">Streak calendar</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <CalendarDays aria-hidden size={20} /> {monthName}
          </h2>
        </div>
        <div className="flex gap-3">
          <StreakMetric label="Current" value={currentStreak} hot />
          <StreakMetric label="Longest" value={longestStreak} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="pb-1 text-center text-[0.62rem] font-bold uppercase text-sumi/35 dark:text-washi/30">
            {label.slice(0, 1)}<span className="hidden sm:inline">{label.slice(1)}</span>
          </div>
        ))}
        {cells.map((day, index) =>
          day ? (
            <div
              key={day.date}
              title={`${day.date}: ${day.studied ? "studied" : day.missed ? "missed" : "future"}`}
              className={`relative grid aspect-square min-h-9 place-items-center rounded-lg text-xs font-semibold sm:min-h-11 ${
                day.future
                  ? "bg-sumi/[0.035] text-sumi/20 dark:bg-white/[0.035] dark:text-white/20"
                  : day.studied
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                    : "bg-red-50 text-red-600 dark:bg-red-950/35 dark:text-red-200"
              }`}
            >
              {Number(day.date.slice(-2))}
              {day.milestone ? (
                <span className="absolute -right-1 -top-1" aria-label={`${day.milestone} day milestone`}>
                  🔥
                </span>
              ) : null}
            </div>
          ) : (
            <div key={`blank-${index}`} />
          ),
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-sumi/45 dark:text-washi/40">
        <Legend color="bg-emerald-100 dark:bg-emerald-900/40" label="Studied" />
        <Legend color="bg-red-50 dark:bg-red-950/35" label="Missed" />
        <Legend color="bg-sumi/[0.035] dark:bg-white/[0.035]" label="Future" />
        <span className="ml-auto flex items-center gap-1"><Flame size={13} className="text-vermilion" /> Milestones: 7, 30, 100</span>
      </div>
    </section>
  );
}

function StreakMetric({ label, value, hot = false }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className="min-w-20 rounded-xl border border-sumi/10 bg-washi/60 px-3 py-2 text-center dark:border-white/10 dark:bg-black/15">
      <p className="text-[0.62rem] uppercase tracking-wider text-sumi/40 dark:text-washi/35">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${hot ? "text-vermilion" : ""}`}>{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${color}`} />{label}</span>;
}

function localIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function StreakCalendarSkeleton() {
  return <div className="h-[31rem] animate-pulse rounded-2xl bg-sumi/5 dark:bg-white/5" aria-label="Loading streak calendar" />;
}
