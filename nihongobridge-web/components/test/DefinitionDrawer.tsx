"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Languages, X } from "lucide-react";

import type { ReviewGrammar, ReviewVocabulary } from "@/types/results";

export type DefinitionSelection =
  | { kind: "word"; item: ReviewVocabulary }
  | { kind: "grammar"; item: ReviewGrammar };

export function DefinitionDrawer({
  selection,
  onClose,
}: {
  selection: DefinitionSelection | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {selection ? (
        <motion.div
          className="fixed inset-0 z-50 bg-sumi/30 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onClose();
          }}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="definition-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-washi p-6 shadow-2xl md:inset-y-0 md:left-auto md:w-[26rem] md:rounded-none md:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close definition"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full hover:bg-sumi/8"
            >
              <X aria-hidden size={19} />
            </button>

            <div className="pr-10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-vermilion">
                {selection.kind === "word" ? "Vocabulary" : "Grammar"}
              </p>
              <h2 id="definition-title" className="jp-text mt-2 text-3xl font-semibold" lang="ja">
                {selection.kind === "word" ? selection.item.word : selection.item.pattern}
              </h2>
              {selection.kind === "word" && selection.item.kana ? (
                <p className="jp-text mt-1 text-base text-sumi/50" lang="ja">{selection.item.kana}</p>
              ) : null}
            </div>

            <div className="mt-7 space-y-3">
              {(selection.kind === "word"
                ? selection.item.meanings
                : selection.item.meaning
              ).map((meaning, index) => (
                <div key={`${meaning.lang}-${index}`} className="rounded-xl border border-sumi/10 bg-white/60 p-4">
                  <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-wider text-sumi/40">
                    <Languages aria-hidden size={13} /> {meaning.lang}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{meaning.value}</p>
                  {"pos" in meaning && typeof meaning.pos === "string" && meaning.pos ? (
                    <p className="mt-2 text-xs text-sumi/40">{meaning.pos}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-start gap-3 rounded-xl bg-vermilion/[0.045] p-4 text-sm text-sumi/65">
              <BookOpen aria-hidden className="mt-0.5 shrink-0 text-vermilion" size={17} />
              <p>This definition is linked directly to the item tested in this question.</p>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
