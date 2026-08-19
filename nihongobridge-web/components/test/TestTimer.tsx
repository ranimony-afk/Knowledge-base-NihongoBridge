"use client";

import { CirclePause, Clock3 } from "lucide-react";

import { formatTime } from "@/lib/test-utils";
import { useTestSessionStore } from "@/stores/test-session-store";

export function TestTimer() {
  const remaining = useTestSessionStore((state) => state.timeRemaining);
  const total = useTestSessionStore((state) => state.totalTimeSeconds);
  const paused = useTestSessionStore((state) => state.timerPaused);
  const ratio = total > 0 ? remaining / total : 1;
  const tone = ratio <= 0.2 ? "text-red-700 bg-red-50 border-red-200" : ratio <= 0.5
    ? "text-amber-800 bg-amber-50 border-amber-200"
    : "text-moss bg-emerald-50/70 border-emerald-200";

  return (
    <div
      role="timer"
      aria-label={`${formatTime(remaining)} remaining${paused ? ", paused for audio" : ""}`}
      aria-live={ratio <= 0.2 ? "assertive" : "off"}
      className={`flex min-w-[7.7rem] items-center justify-center gap-2 rounded-full border px-3 py-2 font-mono text-sm font-semibold tabular-nums transition-colors sm:text-base ${tone} ${
        ratio <= 0.2 && !paused ? "animate-pulse-soft" : ""
      }`}
    >
      {paused ? <CirclePause aria-hidden size={18} /> : <Clock3 aria-hidden size={18} />}
      <span>{formatTime(remaining)}</span>
      <span className="sr-only">remaining</span>
    </div>
  );
}
