"use client";

import { useEffect, useState } from "react";

import {
  KanjiCard,
  KanjiCardLoading,
} from "@/components/kanji/KanjiCard";
import { ExplorerNav } from "@/components/ui/ExplorerNav";
import { loadKanjiDetail } from "@/lib/content-api";
import { demoKanjiDetail, demoWaterStrokePaths } from "@/lib/demo-content";
import type { KanjiDetailData } from "@/types/content";

export function KanjiExplorer({ character, demo = false }: { character: string; demo?: boolean }) {
  const [kanji, setKanji] = useState<KanjiDetailData | null>(demo ? demoKanjiDetail : null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [activeCharacter, setActiveCharacter] = useState(character);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void loadKanjiDetail(activeCharacter, demo)
      .then((value) => {
        if (active) setKanji(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load kanji.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeCharacter, demo]);

  return (
    <main className="min-h-dvh bg-washi text-sumi dark:bg-[#141412] dark:text-washi">
      <ExplorerNav current="kanji" />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-vermilion">漢字 · Kanji explorer</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Read it. Watch it. Write it.</h1>
          <p className="mt-3 text-sm text-sumi/50 dark:text-washi/45">
            Explore readings, stroke order, common words, radicals, and lookalikes.
          </p>
        </div>
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}
        {loading ? (
          <KanjiCardLoading />
        ) : kanji ? (
          <KanjiCard
            kanji={kanji}
            referencePaths={kanji.character === "水" ? demoWaterStrokePaths : []}
            actionContext={demo ? "demo" : "kanji"}
            onSimilarKanji={setActiveCharacter}
          />
        ) : null}
      </div>
    </main>
  );
}
