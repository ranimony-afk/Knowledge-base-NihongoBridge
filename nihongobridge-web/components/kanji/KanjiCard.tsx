"use client";

import { BookOpen, ChevronDown, ChevronUp, PenLine, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { KanjiWritingQuiz } from "@/components/kanji/KanjiWritingQuiz";
import { StrokeOrderAnimation } from "@/components/kanji/StrokeOrderAnimation";
import { useSRSActions } from "@/hooks/useSRSActions";
import type { KanjiDetailData } from "@/types/content";

interface KanjiCardProps {
  kanji: KanjiDetailData;
  referencePaths?: string[];
  actionContext?: string;
  onSimilarKanji?: (character: string) => void;
}

export function KanjiCard({
  kanji,
  referencePaths = [],
  actionContext = "kanji",
  onSimilarKanji,
}: KanjiCardProps) {
  const [writingOpen, setWritingOpen] = useState(false);
  const actions = useSRSActions(actionContext);
  const item = { id: kanji.id, type: "kanji" as const, label: kanji.character };
  const srsState = actions.states[`srs:kanji:${kanji.id}`] ?? "idle";

  return (
    <article className="overflow-hidden rounded-3xl border border-sumi/10 bg-white/65 shadow-paper dark:border-white/10 dark:bg-white/[0.045]">
      <header className="relative border-b border-sumi/10 bg-[#F6F3EC]/70 p-6 text-center dark:border-white/10 dark:bg-white/[0.035]">
        <span className="absolute right-5 top-5 rounded-full bg-vermilion px-3 py-1 text-xs font-bold text-white">
          JLPT {kanji.jlpt_level}
        </span>
        <div className="jp-text mx-auto grid h-44 w-44 place-items-center rounded-3xl border border-sumi/8 bg-white/65 text-[7.5rem] font-light leading-none dark:border-white/10 dark:bg-black/15 sm:h-52 sm:w-52 sm:text-[9rem]">
          {kanji.character}
        </div>
        <p className="mt-3 text-xs tracking-[0.16em] text-sumi/35 dark:text-washi/30">
          {kanji.unicode ?? "KANJI"}
        </p>
      </header>

      <section className="grid gap-5 border-b border-sumi/10 p-5 dark:border-white/10 sm:grid-cols-2 sm:p-7">
        <Info label="音読み · On'yomi" value={kanji.onyomi.join("・") || "—"} japanese />
        <Info label="訓読み · Kun'yomi" value={kanji.kunyomi.join("・") || "—"} japanese />
        <Info
          label="Meaning"
          value={kanji.meanings.map((meaning) => meaning.value).join(", ") || "—"}
        />
        <div className="grid grid-cols-2 gap-3">
          <Info label="Strokes" value={String(kanji.stroke_count ?? "—")} />
          <Info label="Grade" value={String(kanji.grade ?? "—")} />
        </div>
      </section>

      <section className="border-b border-sumi/10 p-5 dark:border-white/10 sm:p-7">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sumi/40 dark:text-washi/35">
          <PenLine aria-hidden size={15} /> Stroke order animation
        </h2>
        <StrokeOrderAnimation
          character={kanji.character}
          strokeCount={kanji.stroke_count}
          svgUrl={kanji.svg_animation_url}
          initialPaths={referencePaths}
        />
      </section>

      <section className="border-b border-sumi/10 p-5 dark:border-white/10 sm:p-7">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sumi/40 dark:text-washi/35">
          <BookOpen aria-hidden size={15} /> Common words
        </h2>
        {kanji.example_words.length ? (
          <div className="mt-4 divide-y divide-sumi/8 overflow-hidden rounded-2xl border border-sumi/8 dark:divide-white/8 dark:border-white/8">
            {kanji.example_words.map((word) => (
              <div key={word.id} className="grid grid-cols-[minmax(4rem,.8fr)_minmax(5rem,1fr)_minmax(0,1.4fr)] items-center gap-3 px-4 py-3 text-sm">
                <span className="jp-text text-base font-semibold">{word.word}</span>
                <span className="jp-text text-sumi/45 dark:text-washi/40">{word.kana}</span>
                <span className="truncate text-sumi/55 dark:text-washi/50">{word.meanings[0]?.value ?? ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-sumi/45 dark:text-washi/40">No common words linked yet.</p>
        )}
      </section>

      <section className="border-b border-sumi/10 p-5 dark:border-white/10 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <TokenGroup label="Radicals" values={kanji.radicals} />
          <TokenGroup
            label="Similar"
            values={[...new Set([...kanji.similar_kanji, ...kanji.lookalikes])]}
            japanese
            onClick={onSimilarKanji}
          />
        </div>
        {kanji.mnemonics[0] ? (
          <div className="mt-5 flex gap-3 rounded-xl bg-amber-50/70 p-4 text-sm text-amber-950 dark:bg-amber-950/25 dark:text-amber-100">
            <Sparkles aria-hidden className="mt-0.5 shrink-0" size={17} />
            <p>{kanji.mnemonics[0].text}</p>
          </div>
        ) : null}
      </section>

      <footer className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWritingOpen((value) => !value)}
            aria-expanded={writingOpen}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-washi dark:bg-washi dark:text-[#141412]"
          >
            <PenLine aria-hidden size={16} /> Writing quiz
            {writingOpen ? <ChevronUp aria-hidden size={15} /> : <ChevronDown aria-hidden size={15} />}
          </button>
          <button
            type="button"
            disabled={srsState === "working" || srsState === "done"}
            onClick={() => void actions.addToSrs([item])}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sumi/15 px-4 text-sm font-semibold disabled:opacity-45 dark:border-white/15"
          >
            <Plus aria-hidden size={16} /> {srsState === "done" ? "Added" : "Add to SRS"}
          </button>
        </div>
        {writingOpen ? (
          <div className="mt-5">
            <KanjiWritingQuiz
              character={kanji.character}
              strokeCount={kanji.stroke_count ?? referencePaths.length}
              referencePaths={referencePaths}
              referenceSvgUrl={kanji.svg_animation_url}
            />
          </div>
        ) : null}
      </footer>
    </article>
  );
}

function Info({ label, value, japanese = false }: { label: string; value: string; japanese?: boolean }) {
  return (
    <div>
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-sumi/35 dark:text-washi/30">{label}</p>
      <p className={`mt-1.5 text-base font-semibold leading-relaxed ${japanese ? "jp-text" : ""}`}>{value}</p>
    </div>
  );
}

function TokenGroup({
  label,
  values,
  japanese = false,
  onClick,
}: {
  label: string;
  values: string[];
  japanese?: boolean;
  onClick?: ((value: string) => void) | undefined;
}) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-sumi/40 dark:text-washi/35">{label}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length ? values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onClick?.(value)}
            disabled={!onClick}
            className={`rounded-lg border border-sumi/10 bg-washi px-3 py-1.5 text-sm font-semibold dark:border-white/10 dark:bg-white/5 ${japanese ? "jp-text text-lg" : ""}`}
          >
            {value}
          </button>
        )) : <span className="text-sm text-sumi/40">—</span>}
      </div>
    </div>
  );
}

export function KanjiCardLoading() {
  return <div className="h-[70rem] animate-pulse rounded-3xl border border-sumi/10 bg-sumi/5 dark:border-white/10 dark:bg-white/5" aria-label="Loading kanji" />;
}

export function KanjiCardEmpty() {
  return <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-sumi/20 p-8 text-center dark:border-white/15"><p className="text-sm text-sumi/50 dark:text-washi/45">Choose a kanji to explore its readings and strokes.</p></div>;
}
