"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Flame,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";

import { AnimatedScore } from "@/components/test/AnimatedScore";
import { SectionBreakdown } from "@/components/test/SectionBreakdown";
import { ShareResultCard } from "@/components/test/ShareResultCard";
import { useTestResults } from "@/hooks/useTestResults";
import { formatTime, testTypeLabel } from "@/lib/test-utils";

export function TestResults({ sessionId }: { sessionId: string }) {
  const { data, loading, error, weakAreas, retry } = useTestResults(sessionId);
  const reduceMotion = useReducedMotion();

  if (loading) return <ResultsLoading />;
  if (error || !data) return <ResultsError message={error ?? "Results are unavailable."} onRetry={() => retry()} />;

  const maxScore = data.testType === "full_mock" ? 180 : 60;
  const scorePercent = Math.round((data.result.score_total / maxScore) * 100);
  const statusTone = data.result.passed ? "text-moss bg-emerald-50" : "text-red-700 bg-red-50";

  return (
    <main className="min-h-dvh bg-washi px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-sumi/10 bg-white/70 p-6 text-center shadow-paper sm:p-10"
        >
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border-[20px] border-vermilion/[0.045]" />
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-vermilion">
            {data.level} {testTypeLabel(data.testType)}
          </p>
          <h1 className="jp-text mt-2 text-2xl font-semibold sm:text-3xl">🎌 Test Complete</h1>

          <div className="mt-8 flex items-end justify-center gap-2">
            <span className="text-6xl font-extrabold tracking-tight sm:text-8xl">
              <AnimatedScore value={data.result.score_total} />
            </span>
            <span className="mb-2 text-xl font-semibold text-sumi/30 sm:mb-3 sm:text-3xl">
              /{maxScore}
            </span>
          </div>
          <p className="mt-2 text-sm text-sumi/50">Total score</p>

          <div className="mx-auto mt-7 max-w-xl">
            <div className="h-3 overflow-hidden rounded-full bg-sumi/10">
              <motion.div
                initial={{ width: reduceMotion ? `${scorePercent}%` : 0 }}
                animate={{ width: `${scorePercent}%` }}
                transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
                className="h-full rounded-full bg-vermilion"
              />
            </div>
            <div className="mt-2 flex justify-between text-xs font-semibold text-sumi/45">
              <span>0</span><span>{scorePercent}%</span><span>{maxScore}</span>
            </div>
          </div>

          <div className={`mx-auto mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${statusTone}`}>
            {data.result.passed ? <Check aria-hidden size={18} strokeWidth={3} /> : <X aria-hidden size={18} strokeWidth={3} />}
            {data.result.passed ? "PASS · 合格" : "NOT YET · もう一度"}
          </div>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-sumi/55">
            {data.result.passed
              ? `${data.level} work completed with a solid result. Review the misses now while they are still fresh.`
              : `This attempt is useful evidence, not a verdict. Focus on the weakest section and try another ${data.level} drill.`}
          </p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1, 0], y: [28, -4, -18, -42], scale: [0.9, 1.08, 1, 0.96] }}
            transition={{ duration: 2.4, delay: 0.7, times: [0, 0.25, 0.75, 1] }}
            className="pointer-events-none absolute right-5 top-5 flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-800 shadow-sm sm:right-10 sm:top-10"
          >
            <Sparkles size={15} /> +{data.result.xp_earned} XP
          </motion.div>
        </motion.header>

        <section className="mt-5">
          <SectionBreakdown scores={data.result.score_by_section} />
        </section>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.15fr]">
          <section className="rounded-2xl border border-sumi/10 bg-white/60 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-sumi/45">Session</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <Metric label="Time" value={`${formatTime(data.result.time_spent)} / ${formatTime(data.totalTimeSeconds)}`} />
              <Metric label="Accuracy" value={`${data.result.accuracy}%`} />
              <Metric label="Correct" value={`${data.result.correct_answers}/${data.result.total_questions}`} />
              <Metric label="XP earned" value={`+${data.result.xp_earned}`} />
            </dl>
          </section>

          <section id="weak-areas" className="rounded-2xl border border-sumi/10 bg-white/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-sumi/45">Weak areas</h2>
                <p className="mt-1 text-xs text-sumi/45">Items missed at least twice</p>
              </div>
              <Flame aria-hidden className="text-vermilion" size={21} />
            </div>
            {weakAreas.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {weakAreas.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="rounded-full border border-vermilion/15 bg-vermilion/[0.045] px-3 py-1.5 text-sm">
                    <span className="jp-text font-semibold">{item.label}</span>
                    <span className="ml-2 text-xs text-vermilion">×{item.misses}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-emerald-50/70 px-4 py-3 text-sm text-moss">
                No item was missed twice. Review the isolated mistakes to keep it that way.
              </p>
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/test/${sessionId}/review?filter=incorrect`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-vermilion px-4 text-sm font-semibold text-white shadow-stamp transition hover:-translate-y-0.5"
          >
            <BookOpenCheck aria-hidden size={17} /> Review mistakes
          </Link>
          <Link
            href={`/test/${sessionId}/review?filter=incorrect#study-actions`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            Study weak areas <ArrowRight aria-hidden size={16} />
          </Link>
          <Link
            href="/test/demo"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sumi/15 bg-white/65 px-4 text-sm font-semibold transition hover:border-sumi/30"
          >
            <RotateCcw aria-hidden size={17} /> New test
          </Link>
          <ShareResultCard data={data} />
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-sumi/45">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums text-sumi">{value}</dd>
    </div>
  );
}

function ResultsLoading() {
  return (
    <main className="min-h-dvh bg-washi p-4 sm:p-8" aria-busy="true">
      <div className="mx-auto max-w-5xl animate-pulse space-y-5">
        <div className="h-[28rem] rounded-3xl bg-sumi/5" />
        <div className="grid gap-3 md:grid-cols-3"><div className="h-44 rounded-2xl bg-sumi/5" /><div className="h-44 rounded-2xl bg-sumi/5" /><div className="h-44 rounded-2xl bg-sumi/5" /></div>
      </div>
    </main>
  );
}

function ResultsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-washi p-6">
      <section className="max-w-md rounded-2xl border border-sumi/10 bg-white/70 p-8 text-center shadow-paper">
        <h1 className="text-xl font-semibold">Results are not ready</h1>
        <p className="mt-2 text-sm text-sumi/55">{message}</p>
        <button type="button" onClick={onRetry} className="mt-6 rounded-xl bg-sumi px-5 py-3 text-sm font-semibold text-white">Try again</button>
      </section>
    </main>
  );
}
