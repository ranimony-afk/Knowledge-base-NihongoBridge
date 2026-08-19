"use client";

import { TestTimer } from "@/components/test/TestTimer";
import { testTypeLabel } from "@/lib/test-utils";
import { useTestSessionStore } from "@/stores/test-session-store";

export function TestHeader() {
  const level = useTestSessionStore((state) => state.level);
  const testType = useTestSessionStore((state) => state.testType);
  const currentIndex = useTestSessionStore((state) => state.currentQuestionIndex);
  const total = useTestSessionStore((state) => state.questionOrder.length);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-sumi/10 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-vermilion bg-vermilion/5 font-bold text-vermilion shadow-[inset_0_0_0_3px_#FAFAF7]">
          {level ?? "–"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-sumi/45">
            NihongoBridge
          </p>
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {level ? `${level} ${testTypeLabel(testType)}` : "Loading test…"}
          </h1>
          <p className="mt-0.5 text-xs text-sumi/55 sm:hidden">
            Question {Math.min(currentIndex + 1, total)} of {total}
          </p>
        </div>
      </div>
      <TestTimer />
    </header>
  );
}
