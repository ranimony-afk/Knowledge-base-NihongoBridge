"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Flag, Layers3, ListFilter, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  DefinitionDrawer,
  type DefinitionSelection,
} from "@/components/test/DefinitionDrawer";
import { ReviewQuestionCard } from "@/components/test/ReviewQuestionCard";
import { useSRSActions, type StudyItem } from "@/hooks/useSRSActions";
import { useTestReview } from "@/hooks/useTestReview";
import type { ReviewFilter } from "@/types/results";

export function TestReview({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = normalizeFilter(searchParams.get("filter"));
  const [filter, setFilter] = useState<ReviewFilter>(initialFilter);
  const [selection, setSelection] = useState<DefinitionSelection | null>(null);
  const { data, flags, loading, error, retry } = useTestReview(sessionId);
  const actions = useSRSActions(sessionId);

  useEffect(() => {
    const next = normalizeFilter(searchParams.get("filter"));
    setFilter(next);
  }, [searchParams]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.questions.filter((question) => {
      if (filter === "correct") return question.is_correct;
      if (filter === "incorrect") return !question.is_correct;
      if (filter === "flagged") return flags.has(question.id);
      return true;
    });
  }, [data, filter, flags]);

  if (loading) return <ReviewLoading />;
  if (error || !data) return <ReviewError message={error ?? "Review is unavailable."} onRetry={() => retry()} />;

  const counts = {
    all: data.questions.length,
    correct: data.questions.filter((question) => question.is_correct).length,
    incorrect: data.questions.filter((question) => !question.is_correct).length,
    flagged: data.questions.filter((question) => flags.has(question.id)).length,
  };
  const missedItems = uniqueStudyItems(
    data.questions
      .filter((question) => !question.is_correct)
      .flatMap((question) => [
        ...question.vocabulary.map((item) => ({ id: item.id, type: "word" as const, label: item.word })),
        ...question.grammar.map((item) => ({ id: item.id, type: "grammar" as const, label: item.pattern })),
      ]),
  );

  const changeFilter = (value: ReviewFilter) => {
    setFilter(value);
    const query = new URLSearchParams(searchParams.toString());
    query.set("filter", value);
    router.replace(`?${query.toString()}`, { scroll: false });
  };

  return (
    <main className="min-h-dvh bg-washi pb-16">
      <header className="border-b border-sumi/10 bg-white/55 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/test/${sessionId}/results`}
              aria-label="Back to test results"
              className="grid h-10 w-10 place-items-center rounded-full border border-sumi/10 hover:bg-sumi/5"
            >
              <ArrowLeft aria-hidden size={18} />
            </Link>
            <div>
              <p className="text-[0.67rem] font-bold uppercase tracking-[0.18em] text-vermilion">Test review</p>
              <h1 className="text-lg font-semibold sm:text-xl">Answers and explanations</h1>
            </div>
          </div>
          <p className="hidden text-sm text-sumi/50 sm:block">
            {counts.correct}/{counts.all} correct
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b border-sumi/10 bg-washi/90 px-3 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <ListFilter aria-hidden size={16} className="mx-1 text-sumi/40" />
          {(["all", "correct", "incorrect", "flagged"] as const).map((value) => (
            <FilterButton
              key={value}
              value={value}
              active={filter === value}
              count={counts[value]}
              onClick={() => changeFilter(value)}
            />
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-sumi/50">
            Jump to
            <select
              aria-label="Jump to question"
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value;
                if (value) document.getElementById(`question-${value}`)?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-lg border border-sumi/15 bg-white px-2.5 py-2 text-sm text-sumi"
            >
              <option value="" disabled>Q#</option>
              {data.questions.map((question, index) => (
                <option key={question.id} value={index + 1}>Q{index + 1}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {missedItems.length ? (
          <section className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-vermilion/15 bg-vermilion/[0.045] p-4 sm:flex-row sm:items-center sm:p-5">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Layers3 aria-hidden size={18} className="text-vermilion" /> Build a mistake deck
              </h2>
              <p className="mt-1 text-sm text-sumi/55">
                {missedItems.length} linked item{missedItems.length === 1 ? "" : "s"} from incorrect answers
              </p>
            </div>
            <button
              type="button"
              onClick={() => void actions.addToSrs(missedItems)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-white"
            >
              <Plus aria-hidden size={16} /> Add missed items to SRS
            </button>
          </section>
        ) : null}

        {actions.message ? (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="flex-1">{actions.message}</span>
            <button type="button" onClick={() => actions.setMessage(null)} aria-label="Dismiss action message">
              <X aria-hidden size={16} />
            </button>
          </div>
        ) : null}

        <AnimatePresence mode="popLayout">
          {filtered.length ? (
            <motion.div layout className="space-y-5">
              {filtered.map((question) => {
                const number = data.questions.findIndex((item) => item.id === question.id) + 1;
                return (
                  <ReviewQuestionCard
                    key={question.id}
                    question={question}
                    number={number}
                    flagged={flags.has(question.id)}
                    onDefinition={setSelection}
                    onAddToSrs={(items) => void actions.addToSrs(items)}
                    onBookmark={(item) => void actions.bookmark(item)}
                    actionStates={actions.states}
                  />
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-sumi/20 py-16 text-center"
            >
              {filter === "correct" ? <Check className="mx-auto text-moss" size={28} /> : filter === "flagged" ? <Flag className="mx-auto text-amber-700" size={28} /> : <X className="mx-auto text-sumi/35" size={28} />}
              <p className="mt-3 text-sm font-semibold">No questions match this filter.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DefinitionDrawer selection={selection} onClose={() => setSelection(null)} />
    </main>
  );
}

function FilterButton({
  value,
  count,
  active,
  onClick,
}: {
  value: ReviewFilter;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
        active ? "bg-sumi text-white" : "border border-sumi/10 bg-white/60 text-sumi/55 hover:text-sumi"
      }`}
    >
      {value} <span className={active ? "text-white/60" : "text-sumi/35"}>{count}</span>
    </button>
  );
}

function uniqueStudyItems(items: StudyItem[]): StudyItem[] {
  return [...new Map(items.map((item) => [`${item.type}:${item.id}`, item])).values()];
}

function normalizeFilter(value: string | null): ReviewFilter {
  return value === "correct" || value === "incorrect" || value === "flagged" ? value : "all";
}

function ReviewLoading() {
  return (
    <main className="min-h-dvh bg-washi p-4 sm:p-8" aria-busy="true">
      <div className="mx-auto max-w-5xl animate-pulse space-y-5">
        <div className="h-20 rounded-2xl bg-sumi/5" />
        <div className="h-[30rem] rounded-2xl bg-sumi/5" />
        <div className="h-[30rem] rounded-2xl bg-sumi/5" />
      </div>
    </main>
  );
}

function ReviewError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-washi p-6">
      <section className="max-w-md rounded-2xl border border-sumi/10 bg-white/70 p-8 text-center">
        <h1 className="text-xl font-semibold">Review unavailable</h1>
        <p className="mt-2 text-sm text-sumi/55">{message}</p>
        <button type="button" onClick={onRetry} className="mt-6 rounded-xl bg-sumi px-5 py-3 text-sm font-semibold text-white">Try again</button>
      </section>
    </main>
  );
}
