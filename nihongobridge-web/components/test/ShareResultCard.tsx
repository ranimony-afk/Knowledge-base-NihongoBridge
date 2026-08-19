"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Share2, X } from "lucide-react";
import { useState } from "react";

import { createResultShareImage } from "@/lib/share-card";
import type { ResultPageData } from "@/types/results";

export function ShareResultCard({ data }: { data: ResultPageData }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const maxScore = data.testType === "full_mock" ? 180 : 60;

  const share = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const blob = await createResultShareImage(data);
      const file = new File([blob], `nihongobridge-${data.level}-result.png`, {
        type: "image/png",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${data.level} NihongoBridge result`,
          text: `I scored ${data.result.score_total}/${maxScore} on NihongoBridge.`,
          files: [file],
        });
      } else {
        downloadBlob(blob, file.name);
        setMessage("Share image downloaded.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : "Could not create the share image.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sumi/15 bg-white/65 px-4 text-sm font-semibold transition hover:border-sumi/30"
      >
        <Share2 aria-hidden size={17} /> Share result
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-sumi/45 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-title"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className="w-full max-w-2xl rounded-3xl bg-washi p-4 shadow-2xl sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="share-title" className="text-lg font-semibold">Share your result</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close share dialog"
                  className="grid h-10 w-10 place-items-center rounded-full hover:bg-sumi/8"
                >
                  <X aria-hidden size={19} />
                </button>
              </div>

              <div className="relative aspect-[1200/630] overflow-hidden rounded-2xl border border-sumi/10 bg-[#FAFAF7] p-[6%] shadow-paper">
                <div className="absolute right-[5%] top-[8%] h-16 w-16 rounded-full border-2 border-vermilion bg-vermilion/5 sm:h-20 sm:w-20" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-vermilion font-bold text-white sm:h-16 sm:w-16 sm:text-xl">
                      {data.level}
                    </span>
                    <div>
                      <p className="font-bold sm:text-xl">NihongoBridge</p>
                      <p className="text-[0.65rem] text-sumi/45 sm:text-sm">JLPT practice result</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-end justify-between">
                    <div>
                      <p className="text-5xl font-extrabold tabular-nums sm:text-7xl">
                        {data.result.score_total}<span className="text-xl text-sumi/30 sm:text-3xl">/{maxScore}</span>
                      </p>
                      <p className={`mt-1 font-bold ${data.result.passed ? "text-moss" : "text-red-700"}`}>
                        {data.result.passed ? "PASS · 合格" : "KEEP GOING"}
                      </p>
                    </div>
                    <p className="text-right text-[0.6rem] text-sumi/45 sm:text-sm">
                      {data.result.accuracy}% accuracy<br />+{data.result.xp_earned} XP
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-xs text-moss">{message}</p>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void share()}
                  className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-sumi px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Download aria-hidden size={17} />
                  {working ? "Creating…" : "Share or download"}
                </button>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
