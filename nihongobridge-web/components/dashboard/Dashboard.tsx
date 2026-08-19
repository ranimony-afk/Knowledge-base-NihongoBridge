"use client";

import {
  ArrowRight,
  BookOpen,
  Brain,
  Flame,
  GraduationCap,
  Headphones,
  Library,
  MessageSquareText,
  PenLine,
  Play,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";

import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { RecentActivityChart } from "@/components/dashboard/RecentActivityChart";
import {
  LevelReadinessCheck,
  LevelReadinessSkeleton,
} from "@/components/progress/LevelReadiness";
import {
  ProgressStats,
  ProgressStatsSkeleton,
} from "@/components/progress/ProgressStats";
import {
  StreakCalendar,
  StreakCalendarSkeleton,
} from "@/components/progress/StreakCalendar";
import {
  StudyGoalSetter,
  StudyGoalSkeleton,
} from "@/components/progress/StudyGoal";
import { useDashboard } from "@/hooks/useDashboard";

export function Dashboard({ demo = false }: { demo?: boolean }) {
  const query = useDashboard(demo);

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError || !query.data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-washi p-6 dark:bg-[#141412] dark:text-washi">
        <section className="max-w-md rounded-2xl border border-sumi/10 bg-white/60 p-8 text-center dark:border-white/10 dark:bg-white/5">
          <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-sumi/50 dark:text-washi/45">
            {query.error instanceof Error ? query.error.message : "Could not load your progress."}
          </p>
          <button type="button" onClick={() => void query.refetch()} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-washi dark:bg-washi dark:text-[#141412]">
            <RotateCcw size={16} /> Try again
          </button>
        </section>
      </main>
    );
  }

  const data = query.data;
  const greeting = greetingForHour(new Date().getHours());
  const progressPercent = Math.min(
    100,
    Math.round((data.cardsStudiedToday / Math.max(1, data.dailyCardGoal)) * 100),
  );

  return (
    <main className="min-h-dvh bg-washi text-sumi dark:bg-[#141412] dark:text-washi">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-vermilion">Your study bridge</p>
            <h1 className="jp-text mt-2 text-3xl font-semibold sm:text-4xl">
              {greeting}, {data.user.name}!
            </h1>
            <p className="mt-2 text-sm text-sumi/45 dark:text-washi/40">
              Small, focused steps are moving you toward {data.level.target}.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
            <Flame aria-hidden size={18} fill="currentColor" /> {data.streak.current} day streak
          </div>
        </header>

        <section aria-label="Today's study summary" className="mt-7 grid gap-4 md:grid-cols-3">
          <SummaryCard
            eyebrow="Due for review"
            title={`${data.dueCards} cards`}
            detail="Overdue cards come first"
            icon={<RotateCcw size={20} />}
            href="/srs/demo"
            action="Start SRS"
          />
          <article className="rounded-2xl border border-sumi/10 bg-white/55 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-sumi/35 dark:text-washi/30">Today's progress</p><h2 className="mt-2 text-2xl font-bold tabular-nums">{data.cardsStudiedToday}/{data.dailyCardGoal}</h2></div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-vermilion/[0.07] text-vermilion"><Sparkles size={20} /></span>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-sumi/10 dark:bg-white/10"><div className="h-full rounded-full bg-vermilion transition-[width] duration-700" style={{ width: `${progressPercent}%` }} /></div>
            <p className="mt-3 text-sm font-semibold text-sumi/55 dark:text-washi/50">{data.xpToday.toLocaleString()} XP today</p>
          </article>
          <article className="rounded-2xl border border-sumi/10 bg-white/55 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-sumi/35 dark:text-washi/30">Level progress</p><h2 className="mt-2 text-2xl font-bold">{data.level.current} <span className="text-sumi/20 dark:text-washi/20">→</span> {data.level.target}</h2></div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-moss dark:bg-emerald-950/30 dark:text-emerald-200"><Target size={20} /></span>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-sumi/10 dark:bg-white/10"><div className="h-full rounded-full bg-moss transition-[width] duration-700" style={{ width: `${data.level.readiness}%` }} /></div>
            <p className="mt-3 text-sm font-semibold text-sumi/55 dark:text-washi/50">{data.level.readiness}% ready</p>
          </article>
        </section>

        <section className="mt-5 rounded-2xl border border-sumi/10 bg-[#F6F3EC]/75 p-4 dark:border-white/10 dark:bg-white/[0.035] sm:p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-vermilion">Continue where you left off</p>
              {data.continueTest ? (
                <><h2 className="mt-1 text-lg font-semibold">{data.continueTest.title}</h2><p className="mt-1 text-sm text-sumi/45 dark:text-washi/40">Section {data.continueTest.section} of {data.continueTest.sectionCount}</p></>
              ) : (
                <><h2 className="mt-1 text-lg font-semibold">No paused session</h2><p className="mt-1 text-sm text-sumi/45 dark:text-washi/40">Start a focused test when you are ready.</p></>
              )}
            </div>
            <Link href={data.continueTest ? `/test/${data.continueTest.sessionId}` : "/test/demo"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sumi px-5 text-sm font-semibold text-washi dark:bg-washi dark:text-[#141412]">
              <Play aria-hidden size={16} fill="currentColor" /> {data.continueTest ? "Resume" : "Start test"}
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-vermilion">Study areas</p><h2 className="mt-1 text-2xl font-semibold">Choose your next focus</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <StudyArea href="/dictionary" label="Dictionary" icon={<Library />} />
            <StudyArea href="/kanji/水" label="Kanji" icon={<PenLine />} />
            <StudyArea href="/dictionary?q=%E3%80%9C%E3%81%A6" label="Grammar" icon={<Brain />} />
            <StudyArea href="/test/demo/results" label="Tests" icon={<GraduationCap />} />
            <StudyArea href="/test/demo/review?filter=incorrect" label="Listening" icon={<Headphones />} />
            <StudyArea href="/test/demo" label="Reading" icon={<BookOpen />} />
            <StudyArea href="/srs/demo" label="Flashcards" icon={<RotateCcw />} />
            <StudyArea href="/dashboard#coming-soon" label="Blog" icon={<MessageSquareText />} muted />
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-sumi/10 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
          <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-vermilion">Recent activity</p><h2 className="mt-1 text-xl font-semibold">Last seven days</h2></div><div className="flex gap-3 text-[0.68rem] text-sumi/45 dark:text-washi/40"><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-vermilion" /> Cards</span><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-moss" /> Tests</span></div></div>
          <div className="mt-3"><RecentActivityChart activity={data.recentActivity} /></div>
        </section>

        <div className="mt-12"><ProgressStats mastery={data.mastery} testScores={data.testScores} accuracyTrend={data.accuracyTrend} heatmap={data.heatmap} weakAreas={data.weakAreas} /></div>

        <div className="mt-8 grid items-start gap-5 xl:grid-cols-[1.15fr_.85fr_.85fr]">
          <StreakCalendar days={data.streakCalendar} currentStreak={data.streak.current} longestStreak={data.streak.longest} />
          <LevelReadinessCheck data={data.readiness} />
          <StudyGoalSetter initialGoal={data.goal} />
        </div>

        <div id="coming-soon" className="mt-10 rounded-2xl border border-dashed border-sumi/15 p-5 text-center text-sm text-sumi/45 dark:border-white/10 dark:text-washi/40">
          Blog study notes are part of the upcoming content phase.
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ eyebrow, title, detail, icon, href, action }: { eyebrow: string; title: string; detail: string; icon: React.ReactNode; href: string; action: string }) {
  return (
    <article className="rounded-2xl border border-sumi/10 bg-white/55 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-sumi/35 dark:text-washi/30">{eyebrow}</p><h2 className="mt-2 text-2xl font-bold">{title}</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-vermilion/[0.07] text-vermilion">{icon}</span></div>
      <p className="mt-3 text-sm text-sumi/45 dark:text-washi/40">{detail}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-vermilion">{action}<ArrowRight size={15} /></Link>
    </article>
  );
}

function StudyArea({ href, label, icon, muted = false }: { href: string; label: string; icon: React.ReactNode; muted?: boolean }) {
  return (
    <Link href={href} className={`group flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-sumi/10 bg-white/55 p-3 text-center transition hover:-translate-y-1 hover:border-vermilion/30 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] ${muted ? "opacity-60" : ""}`}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-sumi/5 text-vermilion transition group-hover:bg-vermilion group-hover:text-white dark:bg-white/8">{icon}</span>
      <span className="text-xs font-semibold sm:text-sm">{label}</span>
    </Link>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 11) return "おはよう";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

export function DashboardSkeleton() {
  return (
    <main className="min-h-dvh bg-washi p-4 dark:bg-[#141412]" aria-label="Loading dashboard" aria-busy="true">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5 pt-16">
        <div className="h-12 w-80 max-w-full rounded bg-sumi/8 dark:bg-white/10" />
        <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-48 rounded-2xl bg-sumi/5 dark:bg-white/5" />)}</div>
        <div className="h-28 rounded-2xl bg-sumi/5 dark:bg-white/5" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-sumi/5 dark:bg-white/5" />)}</div>
        <div className="h-72 rounded-2xl bg-sumi/5 dark:bg-white/5" />
        <ProgressStatsSkeleton />
        <div className="grid gap-5 xl:grid-cols-3"><StreakCalendarSkeleton /><LevelReadinessSkeleton /><StudyGoalSkeleton /></div>
      </div>
    </main>
  );
}
