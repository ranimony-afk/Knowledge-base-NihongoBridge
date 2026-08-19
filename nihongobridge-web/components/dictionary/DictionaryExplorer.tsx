"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DictionaryEntry,
  DictionaryEntryLoading,
} from "@/components/dictionary/DictionaryEntry";
import { DictionarySearch } from "@/components/dictionary/DictionarySearch";
import { ExplorerNav } from "@/components/ui/ExplorerNav";
import { loadDictionaryDetail } from "@/lib/content-api";
import { demoDictionaryDetail } from "@/lib/demo-content";
import type {
  DictionaryDetailData,
  DictionaryEntryData,
} from "@/types/content";

export function DictionaryExplorer({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<DictionaryDetailData | null>(
    demo ? demoDictionaryDetail : null,
  );
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<DictionaryDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (entry: DictionaryEntryData) => {
    setLoading(true);
    setError(null);
    try {
      setSelected(await loadDictionaryDetail(entry.id, demo));
      window.setTimeout(() => {
        document.getElementById("dictionary-detail")?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the entry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-washi text-sumi dark:bg-[#141412] dark:text-washi">
      <ExplorerNav current="dictionary" />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-vermilion">辞書 · Dictionary</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Find the word you need,<br className="hidden sm:block" /> without losing your place.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-sumi/50 dark:text-washi/45">
            Search Japanese, kana, romaji, or English. Try 食べる, みず, or “student”.
          </p>
        </div>

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(26rem,.95fr)]">
          <DictionarySearch demo={demo} onSelect={(entry) => void choose(entry)} />
          <div id="dictionary-detail" className="scroll-mt-6 xl:sticky xl:top-5">
            {error ? (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            ) : null}
            {loading ? (
              <DictionaryEntryLoading />
            ) : selected ? (
              <DictionaryEntry
                entry={selected}
                actionContext={demo ? "demo" : "dictionary"}
                onKanji={(character) => router.push(`/kanji/${encodeURIComponent(character)}`)}
                onGrammar={() => undefined}
                onQuiz={setQuiz}
              />
            ) : (
              <div className="grid min-h-[28rem] place-items-center rounded-3xl border border-dashed border-sumi/20 p-8 text-center dark:border-white/15">
                <p className="text-sm text-sumi/50 dark:text-washi/45">Select a result to open the complete entry.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {quiz ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-sumi/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="dictionary-quiz-title"
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 8 }}
              className="relative w-full max-w-md rounded-3xl bg-washi p-8 text-center shadow-2xl dark:bg-[#1D1D1A]"
            >
              <button
                type="button"
                onClick={() => setQuiz(null)}
                aria-label="Close quiz"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full hover:bg-sumi/5 dark:hover:bg-white/10"
              >
                <X aria-hidden size={18} />
              </button>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-vermilion">Quick quiz</p>
              <h2 id="dictionary-quiz-title" className="jp-text mt-6 text-6xl font-semibold">{quiz.word}</h2>
              <details className="mt-8 rounded-xl border border-sumi/10 bg-white/55 p-4 text-left dark:border-white/10 dark:bg-white/5">
                <summary className="cursor-pointer text-center text-sm font-semibold">Reveal reading and meaning</summary>
                <p className="jp-text mt-4 text-center text-xl">{quiz.kana}</p>
                <p className="mt-2 text-center text-sm text-sumi/55 dark:text-washi/50">
                  {quiz.meanings.map((meaning) => meaning.value).join(" · ")}
                </p>
              </details>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
