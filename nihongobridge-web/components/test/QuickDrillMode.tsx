"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Space } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SafeJapaneseHtml } from "@/components/test/SafeJapaneseHtml";

export interface QuickDrillCard {
  id: string;
  question: string;
  answer: string;
  explanation?: string;
  tag?: string;
}

interface QuickDrillModeProps {
  cards: QuickDrillCard[];
  onRate?: (card: QuickDrillCard, correct: boolean) => void;
  onExit?: () => void;
}

export function QuickDrillMode({ cards, onRate, onExit }: QuickDrillModeProps) {
  const sessionCards = useMemo(() => cards.slice(0, 20), [cards]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, boolean>>({});
  const reduceMotion = useReducedMotion();
  const card = sessionCards[index];
  const complete = index >= sessionCards.length;

  const rate = (correct: boolean) => {
    if (!card || !revealed) return;
    setOutcomes((value) => ({ ...value, [card.id]: correct }));
    onRate?.(card, correct);
    setRevealed(false);
    setIndex((value) => value + 1);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (!complete) setRevealed((value) => !value);
      } else if (event.key === "ArrowLeft" && revealed) {
        event.preventDefault();
        rate(false);
      } else if (event.key === "ArrowRight" && revealed) {
        event.preventDefault();
        rate(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  if (!sessionCards.length) {
    return <div className="rounded-2xl border border-dashed border-sumi/20 p-10 text-center text-sm text-sumi/55">No drill cards are available.</div>;
  }

  if (complete) {
    const correct = Object.values(outcomes).filter(Boolean).length;
    return (
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg rounded-3xl border border-sumi/10 bg-white/70 p-8 text-center shadow-paper"
      >
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-moss">
          <Check aria-hidden size={30} strokeWidth={3} />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-vermilion">Drill complete</p>
        <h2 className="mt-2 text-3xl font-bold tabular-nums">{correct}/{sessionCards.length}</h2>
        <p className="mt-2 text-sm text-sumi/55">
          {Math.round((correct / sessionCards.length) * 100)}% correct across this session.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setOutcomes({});
              setRevealed(false);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-white"
          >
            <RotateCcw aria-hidden size={16} /> Again
          </button>
          {onExit ? (
            <button type="button" onClick={onExit} className="rounded-xl border border-sumi/15 px-4 text-sm font-semibold">Exit</button>
          ) : null}
        </div>
      </motion.section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-xl">
      <div className="mb-4 flex items-center justify-between text-sm text-sumi/50">
        <span className="font-semibold">Quick drill</span>
        <span className="tabular-nums">{index + 1}/{sessionCards.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sumi/10">
        <motion.div
          animate={{ width: `${(index / sessionCards.length) * 100}%` }}
          className="h-full bg-vermilion"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card!.id}
          drag={revealed ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.65}
          onDragEnd={(_, info) => {
            if (info.offset.x <= -80) rate(false);
            if (info.offset.x >= 80) rate(true);
          }}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, x: outcomes[card!.id] ? 100 : -100 }}
          className="mt-5 cursor-pointer touch-pan-y"
          style={{ perspective: 1_200 }}
          onClick={() => setRevealed((value) => !value)}
          role="button"
          tabIndex={0}
          aria-label={revealed ? "Hide answer" : "Reveal answer"}
        >
          <motion.div
            animate={{ rotateY: revealed ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.48, ease: "easeInOut" }}
            className="relative min-h-[23rem] rounded-3xl border border-sumi/10 bg-white/75 shadow-paper [transform-style:preserve-3d]"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center [backface-visibility:hidden]">
              {card!.tag ? (
                <span className="mb-5 rounded-full bg-vermilion/[0.06] px-3 py-1 text-xs font-bold text-vermilion">
                  {card!.tag}
                </span>
              ) : null}
              <SafeJapaneseHtml html={card!.question} className="text-2xl font-semibold leading-[1.8]" />
              <p className="absolute bottom-6 flex items-center gap-2 text-xs text-sumi/40">
                <Space aria-hidden size={15} /> Tap or press space to reveal
              </p>
            </div>
            <div className="absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center p-8 text-center [backface-visibility:hidden]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-vermilion">Answer</p>
              <SafeJapaneseHtml html={card!.answer} className="mt-4 text-3xl font-semibold leading-[1.7]" />
              {card!.explanation ? (
                <p className="mt-5 text-sm leading-relaxed text-sumi/55">{card!.explanation}</p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <div className={`mt-5 grid grid-cols-2 gap-3 transition-opacity ${revealed ? "opacity-100" : "pointer-events-none opacity-30"}`}>
        <button
          type="button"
          onClick={() => rate(false)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 font-semibold text-red-700"
        >
          <ArrowLeft aria-hidden size={18} /> Wrong
        </button>
        <button
          type="button"
          onClick={() => rate(true)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 font-semibold text-moss"
        >
          Correct <ArrowRight aria-hidden size={18} />
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-sumi/40">
        Swipe left/right on mobile · Space to flip · Arrow keys to rate
      </p>
    </section>
  );
}
