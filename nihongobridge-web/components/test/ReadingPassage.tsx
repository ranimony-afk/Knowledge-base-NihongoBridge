"use client";

import { Eraser, Highlighter, Languages, Minus, Plus, X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";

import { SafeJapaneseHtml } from "@/components/test/SafeJapaneseHtml";

interface ReadingPassageProps {
  passage: string;
  children: ReactNode;
}

export function ReadingPassage({ passage, children }: ReadingPassageProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="md:grid md:grid-cols-[minmax(0,3fr)_minmax(19rem,2fr)] md:gap-0">
      <div className="hidden border-r border-sumi/10 bg-[#F7F5EF]/70 md:block">
        <PassagePanel passage={passage} />
      </div>
      <div className="min-w-0 p-4 sm:p-7 lg:p-8">{children}</div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-[5.25rem] left-1/2 z-20 -translate-x-1/2 rounded-full border border-sumi/15 bg-sumi px-5 py-3 text-sm font-semibold text-white shadow-xl md:hidden"
      >
        View passage
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-sumi/30 p-0 backdrop-blur-sm md:hidden">
          <div className="absolute inset-x-0 bottom-0 top-8 overflow-hidden rounded-t-3xl bg-washi shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close passage"
              className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-sumi/8 text-sumi"
            >
              <X aria-hidden size={20} />
            </button>
            <PassagePanel passage={passage} mobile />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PassagePanel({ passage, mobile = false }: { passage: string; mobile?: boolean }) {
  const [showFurigana, setShowFurigana] = useState(true);
  const [fontSize, setFontSize] = useState(19);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);
  const passageRef = useRef<HTMLDivElement>(null);
  const plain = useMemo(() => stripRuby(passage), [passage]);

  const captureHighlight = (event: MouseEvent<HTMLDivElement>) => {
    const container = passageRef.current;
    if (!highlightMode || !container?.contains(event.target as Node)) return;
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length <= 120 && plain.includes(selection)) {
      setHighlights((values) => [...new Set([...values, selection])]);
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <section className={`flex h-full flex-col ${mobile ? "pt-2" : "max-h-[calc(100vh-13rem)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sumi/10 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-vermilion">Passage</p>
          <h2 className="text-sm font-semibold">読解本文</h2>
        </div>
        <div className="flex items-center gap-1">
          <ToolButton
            label={`Furigana ${showFurigana ? "on" : "off"}`}
            active={showFurigana}
            onClick={() => setShowFurigana((value) => !value)}
          >
            <Languages size={15} />
          </ToolButton>
          <ToolButton
            label="Decrease text size"
            onClick={() => setFontSize((value) => Math.max(16, value - 1))}
          >
            <Minus size={15} />
          </ToolButton>
          <span className="min-w-7 text-center text-[0.65rem] tabular-nums text-sumi/45">
            {fontSize}
          </span>
          <ToolButton
            label="Increase text size"
            onClick={() => setFontSize((value) => Math.min(26, value + 1))}
          >
            <Plus size={15} />
          </ToolButton>
          <ToolButton
            label="Highlight mode"
            active={highlightMode}
            onClick={() => setHighlightMode((value) => !value)}
          >
            <Highlighter size={15} />
          </ToolButton>
          {highlights.length ? (
            <ToolButton label="Clear highlights" onClick={() => setHighlights([])}>
              <Eraser size={15} />
            </ToolButton>
          ) : null}
        </div>
      </div>

      <div
        ref={passageRef}
        onMouseUp={captureHighlight}
        className={`passage-scroll min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7 ${
          highlightMode ? "highlight-active cursor-text" : ""
        }`}
        style={{ fontSize }}
      >
        {highlights.length ? (
          <p className="jp-text whitespace-pre-wrap leading-[1.9]" lang="ja">
            {highlightedNodes(plain, highlights)}
          </p>
        ) : (
          <SafeJapaneseHtml
            html={passage}
            showFurigana={showFurigana}
            className="leading-[1.9]"
          />
        )}
        {highlightMode ? (
          <p className="mt-6 border-t border-sumi/10 pt-3 text-xs leading-relaxed text-sumi/45">
            Select a phrase to keep it highlighted. Highlights stay on this device only.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={label.includes("mode") || label.includes("Furigana") ? active : undefined}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
        active ? "bg-vermilion text-white" : "text-sumi/55 hover:bg-sumi/8 hover:text-sumi"
      }`}
    >
      {children}
    </button>
  );
}

function stripRuby(value: string): string {
  return value
    .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, "")
    .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

function highlightedNodes(text: string, highlights: string[]): ReactNode[] {
  const matches = highlights
    .flatMap((value) => {
      const output: Array<{ start: number; end: number }> = [];
      let cursor = 0;
      while ((cursor = text.indexOf(value, cursor)) >= 0) {
        output.push({ start: cursor, end: cursor + value.length });
        cursor += value.length;
      }
      return output;
    })
    .sort((left, right) => left.start - right.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    nodes.push(
      <mark key={`${match.start}-${match.end}`} className="rounded-sm bg-yellow-200/75 px-0.5 text-inherit">
        {text.slice(match.start, match.end)}
      </mark>,
    );
    cursor = match.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
