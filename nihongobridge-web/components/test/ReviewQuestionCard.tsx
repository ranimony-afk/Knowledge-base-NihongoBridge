"use client";

import { motion } from "framer-motion";
import {
  Bookmark,
  BookOpenText,
  Check,
  Layers3,
  Languages,
  Plus,
  X,
} from "lucide-react";
import { useState } from "react";

import type { DefinitionSelection } from "@/components/test/DefinitionDrawer";
import { ReviewAudioPlayer } from "@/components/test/ReviewAudioPlayer";
import { SafeJapaneseHtml } from "@/components/test/SafeJapaneseHtml";
import type { StudyItem } from "@/hooks/useSRSActions";
import type { ReviewQuestion } from "@/types/results";

interface ReviewQuestionCardProps {
  question: ReviewQuestion;
  number: number;
  flagged: boolean;
  onDefinition: (selection: DefinitionSelection) => void;
  onAddToSrs: (items: StudyItem[]) => void;
  onBookmark: (item: StudyItem) => void;
  actionStates: Record<string, "idle" | "working" | "done" | "error">;
}

export function ReviewQuestionCard({
  question,
  number,
  flagged,
  onDefinition,
  onAddToSrs,
  onBookmark,
  actionStates,
}: ReviewQuestionCardProps) {
  const [language, setLanguage] = useState<"jp" | "en">("en");
  const [showFurigana, setShowFurigana] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const studyItems: StudyItem[] = [
    ...question.vocabulary.map((item) => ({ id: item.id, type: "word" as const, label: item.word })),
    ...question.grammar.map((item) => ({ id: item.id, type: "grammar" as const, label: item.pattern })),
  ];

  return (
    <motion.article
      id={`question-${number}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-sumi/10 bg-white/65 shadow-paper"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sumi/10 bg-[#F6F3EC]/70 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="font-bold tabular-nums">Q{number}</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
              question.is_correct ? "bg-emerald-50 text-moss" : "bg-red-50 text-red-700"
            }`}
          >
            {question.is_correct ? <Check aria-hidden size={13} strokeWidth={3} /> : <X aria-hidden size={13} strokeWidth={3} />}
            {question.is_correct ? "Correct" : "Incorrect"}
          </span>
          <span className="rounded-full border border-sumi/10 bg-white/70 px-2.5 py-1 text-[0.68rem] font-semibold capitalize text-sumi/55">
            {question.section_type}
          </span>
          {flagged ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[0.68rem] font-semibold text-amber-800">
              Flagged
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowFurigana((value) => !value)}
          aria-pressed={showFurigana}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-sumi/55 hover:bg-sumi/5"
        >
          <Languages aria-hidden size={14} /> Furigana {showFurigana ? "on" : "off"}
        </button>
      </header>

      <div className="p-4 sm:p-6">
        <SafeJapaneseHtml
          html={question.question_jp ?? ""}
          showFurigana={showFurigana}
          className="text-lg font-medium leading-[1.8] sm:text-xl"
        />
        {question.question_en ? (
          <p className="mt-2 text-sm text-sumi/50">{question.question_en}</p>
        ) : null}

        {typeof question.stimulus?.passage === "string" ? (
          <div className="mt-5 rounded-xl border-l-4 border-vermilion/40 bg-[#F7F5EF] p-4">
            <SafeJapaneseHtml
              html={question.stimulus.passage}
              showFurigana={showFurigana}
              className="text-sm leading-[1.9]"
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-2.5">
          {question.options.map((option, index) => {
            const correct = option.id === question.correct_answer;
            const selected = option.id === question.user_answer;
            const wrongSelection = selected && !correct;
            return (
              <div
                key={option.id}
                className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 ${
                  correct
                    ? "border-emerald-300 bg-emerald-50/70"
                    : wrongSelection
                      ? "border-red-300 bg-red-50/75"
                      : "border-sumi/8 bg-washi/60"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    correct
                      ? "bg-moss text-white"
                      : wrongSelection
                        ? "bg-red-600 text-white"
                        : "bg-sumi/8 text-sumi/55"
                  }`}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="jp-text min-w-0 flex-1 text-sm font-medium leading-relaxed sm:text-base">
                  {option.text_jp}
                </span>
                <span className="shrink-0 text-[0.68rem] font-bold">
                  {correct ? "Correct ✓" : wrongSelection ? "Your answer ✕" : selected ? "Your answer" : ""}
                </span>
              </div>
            );
          })}
        </div>

        {question.section_type === "listening" && question.audio_url ? (
          <ReviewAudioPlayer source={`/api/listening/${encodeURIComponent(question.id)}/audio`} />
        ) : null}
        {question.section_type === "listening" && question.stimulus?.transcript?.length ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowTranscript((value) => !value)}
              className="text-xs font-bold text-vermilion hover:underline"
            >
              {showTranscript ? "Hide transcript" : "Show transcript"}
            </button>
            {showTranscript ? (
              <div className="mt-2 space-y-2 rounded-xl bg-[#F6F3EC] p-4">
                {question.stimulus.transcript.map((line, index) => (
                  <div key={`${line.speaker}-${index}`} className="flex gap-3 text-sm">
                    <span className="w-7 shrink-0 font-bold text-vermilion">
                      {line.speaker ?? "—"}
                    </span>
                    <SafeJapaneseHtml html={line.text} className="leading-relaxed" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <section className="mt-6 rounded-xl border border-amber-200/70 bg-amber-50/55 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <BookOpenText aria-hidden size={17} className="text-amber-800" /> Explanation
            </h3>
            <div className="flex rounded-lg border border-amber-200 bg-white/60 p-0.5 text-xs font-semibold">
              {(["jp", "en"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLanguage(value)}
                  className={`rounded-md px-2.5 py-1 ${language === value ? "bg-sumi text-white" : "text-sumi/50"}`}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {language === "jp" ? (
            <SafeJapaneseHtml
              html={question.explanation_jp ?? "説明はありません。"}
              showFurigana={showFurigana}
              className="mt-3 text-sm leading-relaxed"
            />
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-sumi/70">
              {question.explanation_en ?? "No explanation is available."}
            </p>
          )}
        </section>

        {studyItems.length ? (
          <section className="mt-6" id={number === 1 ? "study-actions" : undefined}>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Layers3 aria-hidden size={17} className="text-vermilion" /> Linked study items
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {question.vocabulary.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onDefinition({ kind: "word", item })}
                  className="jp-text rounded-full border border-sumi/10 bg-washi px-3 py-1.5 text-sm font-semibold hover:border-vermilion/40"
                >
                  📖 {item.word}
                </button>
              ))}
              {question.grammar.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onDefinition({ kind: "grammar", item })}
                  className="jp-text rounded-full border border-sumi/10 bg-washi px-3 py-1.5 text-sm font-semibold hover:border-vermilion/40"
                >
                  📚 {item.pattern}
                </button>
              ))}
            </div>

            {!question.is_correct ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onAddToSrs(studyItems)}
                  disabled={studyItems.every(
                    (item) => actionStates[`srs:${item.type}:${item.id}`] === "done",
                  )}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sumi px-3.5 text-xs font-semibold text-white disabled:opacity-45"
                >
                  <Plus aria-hidden size={15} />
                  {studyItems.every(
                    (item) => actionStates[`srs:${item.type}:${item.id}`] === "done",
                  )
                    ? "Added to SRS"
                    : "Add all to SRS"}
                </button>
                {studyItems.map((item) => (
                  <button
                    key={`bookmark-${item.type}-${item.id}`}
                    type="button"
                    onClick={() => onBookmark(item)}
                    disabled={actionStates[`bookmark:${item.type}:${item.id}`] === "done"}
                    aria-label={`Bookmark ${item.label}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-sumi/15 px-3 text-xs font-semibold disabled:opacity-45"
                  >
                    <Bookmark aria-hidden size={14} />
                    {actionStates[`bookmark:${item.type}:${item.id}`] === "done"
                      ? "Bookmarked"
                      : item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </motion.article>
  );
}
