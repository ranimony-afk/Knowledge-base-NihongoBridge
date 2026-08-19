"use client";

import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { SafeJapaneseHtml } from "@/components/test/SafeJapaneseHtml";
import type {
  SrsConfidence,
  SrsReviewContent,
} from "@/types/content";

interface SRSReviewCardProps {
  card: SrsReviewContent;
  intervals?: Partial<Record<SrsConfidence, string>>;
  onRate: (confidence: SrsConfidence) => void | Promise<void>;
  disabled?: boolean;
}

const confidenceOptions: Array<{
  id: SrsConfidence;
  label: string;
  key: string;
  classes: string;
}> = [
  {
    id: "again",
    label: "Again",
    key: "1",
    classes: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/35 dark:text-red-200",
  },
  {
    id: "hard",
    label: "Hard",
    key: "2",
    classes: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/35 dark:text-orange-200",
  },
  {
    id: "good",
    label: "Good",
    key: "3",
    classes: "border-emerald-300 bg-emerald-50 text-moss dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200",
  },
  {
    id: "easy",
    label: "Easy",
    key: "4",
    classes: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-200",
  },
];

export function SRSReviewCard({
  card,
  intervals = {
    again: "1 day",
    hard: "3 days",
    good: "7 days",
    easy: "14 days",
  },
  onRate,
  disabled = false,
}: SRSReviewCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [working, setWorking] = useState<SrsConfidence | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setFlipped(false);
    setWorking(null);
  }, [card.id]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button, [contenteditable='true']")) return;
      if (event.code === "Space") {
        event.preventDefault();
        setFlipped((value) => !value);
        return;
      }
      const option = confidenceOptions.find((item) => item.key === event.key);
      if (option && flipped && !disabled && !working) {
        event.preventDefault();
        void rate(option.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const rate = async (confidence: SrsConfidence) => {
    if (disabled || working || !flipped) return;
    setWorking(confidence);
    try {
      await onRate(confidence);
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-center justify-between text-xs text-sumi/45 dark:text-washi/40">
        <span className="rounded-full border border-sumi/10 px-2.5 py-1 font-semibold uppercase dark:border-white/10">
          {card.itemType} {card.jlptLevel ? `· ${card.jlptLevel}` : ""}
        </span>
        <span>Space to flip · 1–4 to rate</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? "Show flashcard front" : "Reveal flashcard answer"}
        className="block w-full text-left"
        style={{ perspective: 1_200 }}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.48, ease: "easeInOut" }}
          className="relative min-h-[27rem] rounded-3xl border border-sumi/10 bg-white/70 shadow-paper [transform-style:preserve-3d] dark:border-white/10 dark:bg-white/[0.045]"
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center [backface-visibility:hidden]">
            <SafeJapaneseHtml html={card.front} className="text-5xl font-semibold leading-[1.6] sm:text-6xl" />
            <p className="absolute bottom-7 flex items-center gap-2 text-xs text-sumi/35 dark:text-washi/30">
              <RotateCcw aria-hidden size={14} /> Tap to reveal
            </p>
          </div>

          <div className="absolute inset-0 flex [transform:rotateY(180deg)] flex-col justify-center p-7 [backface-visibility:hidden] sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-vermilion">Answer</p>
            <SafeJapaneseHtml html={card.front} className="mt-2 text-3xl font-semibold leading-relaxed" />
            {card.reading ? <p className="jp-text mt-1 text-sm text-sumi/45 dark:text-washi/40">{card.reading}</p> : null}
            <ol className="mt-6 space-y-2">
              {card.meanings.map((meaning, index) => (
                <li key={`${meaning}-${index}`} className="flex gap-2 text-base leading-relaxed">
                  <span className="font-bold text-vermilion">{index + 1}.</span>{meaning}
                </li>
              ))}
            </ol>
            {card.example ? (
              <div className="mt-6 rounded-xl border-l-4 border-vermilion/40 bg-[#F6F3EC] p-4 dark:bg-black/20">
                <SafeJapaneseHtml html={card.example} className="text-sm leading-[1.8]" />
              </div>
            ) : null}
            {card.grammar ? <p className="mt-4 text-sm text-sumi/55 dark:text-washi/50">Grammar: {card.grammar}</p> : null}
          </div>
        </motion.div>
      </button>

      <div className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 ${flipped ? "" : "pointer-events-none opacity-35"}`}>
        {confidenceOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled || Boolean(working)}
            onClick={() => void rate(option.id)}
            className={`min-h-[4.25rem] rounded-xl border-2 px-2 text-center transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 ${option.classes}`}
          >
            <span className="block text-sm font-bold">{working === option.id ? "Saving…" : option.label}</span>
            <span className="mt-1 block text-[0.68rem] opacity-70">{intervals[option.id] ?? "—"}</span>
            <kbd className="mt-1 hidden text-[0.6rem] opacity-45 sm:block">{option.key}</kbd>
          </button>
        ))}
      </div>
    </section>
  );
}

export function SRSReviewCardLoading() {
  return <div className="mx-auto h-[35rem] max-w-2xl animate-pulse rounded-3xl bg-sumi/5 dark:bg-white/5" aria-label="Loading SRS card" />;
}

export function SRSReviewCardEmpty() {
  return <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-sumi/20 py-16 text-center dark:border-white/15"><p className="font-semibold">No cards are due.</p><p className="mt-1 text-sm text-sumi/45 dark:text-washi/40">You are caught up for now.</p></div>;
}
