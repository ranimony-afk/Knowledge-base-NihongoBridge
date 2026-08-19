"use client";

import {
  Grid2X2,
  Headphones,
  Image as ImageIcon,
  List,
  Search,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/admin/PageHeader";
import { KanjiEditModal } from "@/components/kanji/KanjiEditModal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { JlptLevel, KanjiAdminEntry } from "@/types/admin";

export function KanjiManager() {
  const entries = useAdminStore((state) => state.kanji);
  const update = useAdminStore((state) => state.updateKanji);
  const toast = useToast();
  const [view, setView] = useState<"grid" | "table">("grid");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<JlptLevel | "ALL">("ALL");
  const [grade, setGrade] = useState("ALL");
  const [hasSvg, setHasSvg] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [editing, setEditing] = useState<KanjiAdminEntry | null>(null);

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        const q = query.toLowerCase();
        return (
          (!q || entry.character.includes(query) || [...entry.onyomi, ...entry.kunyomi, ...entry.meanings.map((item) => item.value)].some((value) => value.toLowerCase().includes(q))) &&
          (level === "ALL" || entry.jlptLevel === level) &&
          (grade === "ALL" || entry.grade === Number(grade)) &&
          (!hasSvg || Boolean(entry.svgUrl)) &&
          (!hasAudio || Boolean(entry.audioUrl))
        );
      }),
    [entries, grade, hasAudio, hasSvg, level, query],
  );

  const importSvgBatch = (files: FileList) => {
    let matched = 0;
    for (const file of Array.from(files)) {
      const character = file.name.replace(/\.svg$/i, "").slice(-1);
      const entry = entries.find((item) => item.character === character);
      if (entry) {
        update(entry.id, { svgUrl: URL.createObjectURL(file) });
        matched += 1;
      }
    }
    toast.success(`Matched ${matched} of ${files.length} KanjiVG SVG files.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Kanji manager"
        description="Review readings and mnemonics, inspect media coverage, and import KanjiVG stroke files."
        actions={
          <label>
            <Button type="button" variant="secondary" className="pointer-events-none"><Upload size={16} /> Batch SVG import</Button>
            <input type="file" accept=".svg" multiple className="sr-only" onChange={(event) => event.target.files && importSvgBatch(event.target.files)} />
          </label>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search character, reading, meaning…" className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-admin" />
          </label>
          <select value={level} onChange={(event) => setLevel(event.target.value as JlptLevel | "ALL")} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="ALL">All levels</option>{["N5","N4","N3","N2","N1","NONE"].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={grade} onChange={(event) => setGrade(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="ALL">All grades</option>{Array.from({ length: 9 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select>
          <Toggle active={hasSvg} onClick={() => setHasSvg((value) => !value)} icon={<ImageIcon size={14} />} label="Has SVG" />
          <Toggle active={hasAudio} onClick={() => setHasAudio((value) => !value)} icon={<Headphones size={14} />} label="Has audio" />
          <div className="flex rounded-lg border border-slate-200 p-1">
            <button type="button" onClick={() => setView("grid")} aria-label="Grid view" aria-pressed={view === "grid"} className={`grid h-8 w-8 place-items-center rounded ${view === "grid" ? "bg-ink text-white" : "text-slate-500"}`}><Grid2X2 size={15} /></button>
            <button type="button" onClick={() => setView("table")} aria-label="Table view" aria-pressed={view === "table"} className={`grid h-8 w-8 place-items-center rounded ${view === "table" ? "bg-ink text-white" : "text-slate-500"}`}><List size={15} /></button>
          </div>
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {filtered.map((entry) => (
              <button key={entry.id} type="button" onClick={() => setEditing(entry)} className="group relative rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-1 hover:border-admin/30 hover:bg-white hover:shadow-md">
                <span className="jp-text block text-center text-6xl font-light">{entry.character}</span>
                <div className="mt-4 flex items-center justify-between"><span className="rounded-full bg-white px-2 py-1 text-[.65rem] font-bold">{entry.jlptLevel}</span><span className="text-[.65rem] text-slate-400">{entry.strokeCount} strokes</span></div>
                <p className="mt-2 truncate text-xs text-slate-500">{entry.meanings[0]?.value}</p>
                <div className="absolute right-2 top-2 flex gap-1">{entry.svgUrl ? <span title="Has SVG" className="h-2 w-2 rounded-full bg-violet-500" /> : null}{entry.audioUrl ? <span title="Has audio" className="h-2 w-2 rounded-full bg-emerald-500" /> : null}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[.68rem] uppercase text-slate-500"><tr><th className="px-4 py-3">Kanji</th><th className="px-3 py-3">Readings</th><th className="px-3 py-3">Meaning</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Grade</th><th className="px-3 py-3">Media</th></tr></thead><tbody>{filtered.map((entry) => <tr key={entry.id} onClick={() => setEditing(entry)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"><td className="jp-text px-4 py-3 text-3xl">{entry.character}</td><td className="jp-text px-3 py-3 text-slate-600">{entry.onyomi.join("、")} · {entry.kunyomi.join("、")}</td><td className="px-3 py-3">{entry.meanings[0]?.value}</td><td className="px-3 py-3">{entry.jlptLevel}</td><td className="px-3 py-3">{entry.grade ?? "—"}</td><td className="px-3 py-3"><span className="text-xs text-slate-500">{entry.svgUrl ? "SVG " : ""}{entry.audioUrl ? "Audio" : ""}</span></td></tr>)}</tbody></table>
          </div>
        )}
        {!filtered.length ? <div className="py-16 text-center text-sm text-slate-400">No kanji match these filters.</div> : null}
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">{filtered.length} kanji</div>
      </section>

      <KanjiEditModal entry={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />
    </div>
  );
}

function Toggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${active ? "border-admin bg-red-50 text-admin" : "border-slate-200 text-slate-500"}`}>{icon}{label}</button>;
}
