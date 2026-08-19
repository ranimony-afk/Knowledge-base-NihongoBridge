"use client";

import { motion, useReducedMotion } from "framer-motion";

import type { CompleteResult } from "@/types/results";

export function SectionBreakdown({ scores }: { scores: CompleteResult["score_by_section"] }) {
  const items = [
    { label: "Vocabulary", jp: "語彙", value: scores.vocabulary },
    { label: "Grammar + Reading", jp: "文法・読解", value: scores.grammar_reading },
    { label: "Listening", jp: "聴解", value: scores.listening },
  ].filter((item) => item.value.total > 0);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item, index) => (
        <SectionCard key={item.label} {...item} delay={index * 0.1} />
      ))}
    </div>
  );
}

function SectionCard({
  label,
  jp,
  value,
  delay,
}: {
  label: string;
  jp: string;
  value: CompleteResult["score_by_section"]["vocabulary"];
  delay: number;
}) {
  const reduceMotion = useReducedMotion();
  const percent = value.max_score ? Math.round((value.score / value.max_score) * 100) : 0;
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl border border-sumi/10 bg-white/70 p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="jp-text text-xs font-semibold text-vermilion">{jp}</p>
          <h3 className="mt-0.5 text-sm font-semibold">{label}</h3>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[0.65rem] font-bold ${
            value.minimum_met ? "bg-emerald-50 text-moss" : "bg-red-50 text-red-700"
          }`}
        >
          {value.minimum_met ? "Minimum met" : "Below minimum"}
        </span>
      </div>
      <p className="mt-5 text-2xl font-bold tabular-nums">
        {value.score}<span className="text-sm font-medium text-sumi/35">/{value.max_score}</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sumi/8">
        <motion.div
          className="h-full rounded-full bg-vermilion"
          initial={{ width: reduceMotion ? `${percent}%` : 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ delay: delay + 0.15, duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-sumi/45">
        <span>{value.correct}/{value.total} correct</span>
        <span>{percent}%</span>
      </div>
    </motion.article>
  );
}
