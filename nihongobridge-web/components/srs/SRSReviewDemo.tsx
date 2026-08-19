"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useState } from "react";

import { SRSReviewCard } from "@/components/srs/SRSReviewCard";
import { ExplorerNav } from "@/components/ui/ExplorerNav";
import { demoSrsCards } from "@/lib/demo-content";
import type { SrsConfidence } from "@/types/content";

export function SRSReviewDemo() {
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, SrsConfidence>>({});
  const card = demoSrsCards[index];

  const rate = async (confidence: SrsConfidence) => {
    if (!card) return;
    await new Promise((resolve) => setTimeout(resolve, 320));
    setRatings((values) => ({ ...values, [card.id]: confidence }));
    setIndex((value) => value + 1);
  };

  return (
    <main className="min-h-dvh bg-washi text-sumi dark:bg-[#141412] dark:text-washi">
      <ExplorerNav current="srs" />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-vermilion">復習 · SRS review</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">One card at a time.</h1>
            <p className="mt-3 text-sm text-sumi/50 dark:text-washi/45">
              Flip the card, answer honestly, and see when it returns.
            </p>
          </div>
          <span className="rounded-full border border-sumi/10 px-3 py-1.5 text-sm font-semibold tabular-nums dark:border-white/10">
            {Math.min(index + 1, demoSrsCards.length)}/{demoSrsCards.length}
          </span>
        </div>

        {card ? (
          <SRSReviewCard
            key={card.id}
            card={card}
            intervals={{ again: "1 day", hard: "3 days", good: "7 days", easy: "18 days" }}
            onRate={rate}
          />
        ) : (
          <section className="mx-auto max-w-lg rounded-3xl border border-sumi/10 bg-white/65 p-8 text-center shadow-paper dark:border-white/10 dark:bg-white/[0.045]">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-moss dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 aria-hidden size={30} />
            </span>
            <h2 className="mt-5 text-2xl font-semibold">Review complete</h2>
            <p className="mt-2 text-sm text-sumi/50 dark:text-washi/45">
              {Object.keys(ratings).length} cards scheduled. You are caught up.
            </p>
            <button
              type="button"
              onClick={() => {
                setIndex(0);
                setRatings({});
              }}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-washi dark:bg-washi dark:text-[#141412]"
            >
              <RotateCcw aria-hidden size={16} /> Review demo again
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
