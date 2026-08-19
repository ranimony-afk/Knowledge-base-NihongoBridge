"use client";

import { Flag } from "lucide-react";

interface FlagButtonProps {
  active: boolean;
  onToggle: () => void;
}

export function FlagButton({ active, onToggle }: FlagButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Remove question flag" : "Flag question for review"}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
        active
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-sumi/10 bg-white/70 text-sumi/60 hover:border-sumi/25 hover:text-sumi"
      }`}
    >
      <Flag aria-hidden size={17} fill={active ? "currentColor" : "none"} />
      <span className="hidden sm:inline">{active ? "Flagged" : "Flag"}</span>
    </button>
  );
}
