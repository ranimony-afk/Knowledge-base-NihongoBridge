import type { Metadata } from "next";
import { Suspense } from "react";

import { DictionaryExplorer } from "@/components/dictionary/DictionaryExplorer";

export const metadata: Metadata = {
  title: "Japanese Dictionary · NihongoBridge",
  description: "Search words, readings, meanings, examples, kanji, and grammar.",
};

export default function DictionaryPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-washi dark:bg-[#141412]" />}>
      <DictionaryExplorer demo />
    </Suspense>
  );
}
