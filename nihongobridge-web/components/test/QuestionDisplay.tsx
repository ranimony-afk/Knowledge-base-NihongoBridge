"use client";

import { BookOpenText, Languages } from "lucide-react";
import { useState } from "react";

import { SafeJapaneseHtml } from "@/components/test/SafeJapaneseHtml";
import type { TestQuestion } from "@/types/test";

interface QuestionDisplayProps {
  question: TestQuestion;
  compact?: boolean;
}

export function QuestionDisplay({ question, compact = false }: QuestionDisplayProps) {
  const [showFurigana, setShowFurigana] = useState(true);
  const hasRuby = Boolean(question.question_jp?.includes("<ruby"));

  return (
    <section aria-labelledby={`question-${question.id}`} className={compact ? "" : "pt-1"}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sumi/[0.055] px-2.5 py-1 text-[0.67rem] font-bold uppercase tracking-[0.15em] text-sumi/55">
          <BookOpenText aria-hidden size={13} />
          {question.section_type}
        </span>
        <button
          type="button"
          onClick={() => setShowFurigana((value) => !value)}
          aria-pressed={showFurigana}
          disabled={!hasRuby}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-sumi/55 transition hover:bg-sumi/5 hover:text-sumi disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Languages aria-hidden size={15} />
          Furigana {showFurigana ? "on" : "off"}
        </button>
      </div>

      <div id={`question-${question.id}`}>
        <SafeJapaneseHtml
          html={question.question_jp ?? ""}
          showFurigana={showFurigana}
          className={`font-medium leading-[1.8] text-sumi ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}
        />
        {question.question_en ? (
          <p className="mt-3 text-sm leading-relaxed text-sumi/50">{question.question_en}</p>
        ) : null}
      </div>

      {question.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.image_url}
          alt="Question reference"
          className="mt-5 max-h-72 w-full rounded-xl border border-sumi/10 object-contain"
        />
      ) : null}
    </section>
  );
}
