"use client";

import { Check, Cloud, CloudOff, LoaderCircle } from "lucide-react";
import { useEffect } from "react";

import type { AnswerSyncState } from "@/stores/test-session-store";
import type { TestOption } from "@/types/test";

interface AnswerOptionsProps {
  questionId: string;
  options: TestOption[];
  selected?: string | undefined;
  syncState?: AnswerSyncState | undefined;
  onSelect: (optionId: string) => void;
}

export function AnswerOptions({
  questionId,
  options,
  selected,
  syncState = "idle",
  onSelect,
}: AnswerOptionsProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const index = Number(event.key) - 1;
      const option = options[index];
      if (option && index >= 0 && index < 4) {
        event.preventDefault();
        onSelect(option.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onSelect, options]);

  return (
    <fieldset aria-describedby={`${questionId}-sync`} className="mt-7">
      <legend className="sr-only">Choose one answer</legend>
      <div className="grid gap-3" role="radiogroup" aria-label="Answer choices">
        {options.map((option, index) => {
          const active = selected === option.id;
          return (
            <label
              key={option.id}
              className={`group flex min-h-[3.75rem] cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-3 transition-all sm:px-4 ${
                active
                  ? "border-vermilion bg-vermilion/[0.055] shadow-[0_0_0_1px_rgba(192,57,43,.08)]"
                  : "border-sumi/10 bg-white/65 hover:-translate-y-0.5 hover:border-sumi/25 hover:bg-white hover:shadow-sm"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name={`answer-${questionId}`}
                value={option.id}
                checked={active}
                onChange={() => onSelect(option.id)}
              />
              <span
                aria-hidden
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${
                  active
                    ? "border-vermilion bg-vermilion text-white"
                    : "border-sumi/15 bg-washi text-sumi/55 group-hover:border-sumi/30"
                }`}
              >
                {active ? <Check size={16} strokeWidth={3} /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="jp-text block text-base font-medium leading-relaxed sm:text-lg" lang="ja">
                  {option.text_jp}
                </span>
                {option.text_en ? (
                  <span className="mt-0.5 block text-xs text-sumi/45">{option.text_en}</span>
                ) : null}
              </span>
              <kbd className="hidden rounded border border-sumi/10 bg-washi px-1.5 py-0.5 text-[0.65rem] text-sumi/40 sm:block">
                {index + 1}
              </kbd>
            </label>
          );
        })}
      </div>
      <p
        id={`${questionId}-sync`}
        className={`mt-2 flex h-5 items-center justify-end gap-1.5 text-xs ${
          syncState === "error" ? "text-red-700" : "text-sumi/40"
        }`}
        aria-live="polite"
      >
        {syncState === "saving" ? (
          <><LoaderCircle className="animate-spin" size={13} /> Saving…</>
        ) : syncState === "saved" ? (
          <><Cloud size={13} /> Saved</>
        ) : syncState === "error" ? (
          <><CloudOff size={13} /> Not synced — choose again to retry</>
        ) : null}
      </p>
    </fieldset>
  );
}
