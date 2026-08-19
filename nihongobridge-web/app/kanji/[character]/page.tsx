import type { Metadata } from "next";

import { KanjiExplorer } from "@/components/kanji/KanjiExplorer";

export const metadata: Metadata = {
  title: "Kanji Explorer · NihongoBridge",
};

export default function KanjiPage({ params }: { params: { character: string } }) {
  return <KanjiExplorer character={params.character} demo />;
}
