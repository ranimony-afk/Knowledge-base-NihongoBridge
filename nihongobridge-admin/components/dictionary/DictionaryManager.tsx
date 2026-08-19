"use client";

import {
  Download,
  Edit3,
  FileUp,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/admin/PageHeader";
import { DictionaryEditModal } from "@/components/dictionary/DictionaryEditModal";
import { DictionaryImportModal } from "@/components/dictionary/DictionaryImportModal";
import { AIGenerateModal } from "@/components/forms/AIGenerateModal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { DictionaryAdminEntry, JlptLevel } from "@/types/admin";

const pageSize = 8;

export function DictionaryManager() {
  const entries = useAdminStore((state) => state.dictionary);
  const update = useAdminStore((state) => state.updateDictionary);
  const bulk = useAdminStore((state) => state.bulkDictionary);
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<JlptLevel | "ALL">("ALL");
  const [source, setSource] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<DictionaryAdminEntry | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        const q = search.toLowerCase();
        return (
          (!q || [entry.word, entry.kana, entry.romaji, ...entry.meanings.map((item) => item.value)].some((value) => value.toLowerCase().includes(q))) &&
          (level === "ALL" || entry.jlptLevel === level) &&
          (source === "ALL" || entry.source === source)
        );
      }),
    [entries, level, search, source],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const sources = [...new Set(entries.map((entry) => entry.source))];

  const toggleAll = () => {
    const visibleIds = visible.map((entry) => entry.id);
    setSelected((current) =>
      visibleIds.every((id) => current.has(id))
        ? new Set([...current].filter((id) => !visibleIds.includes(id)))
        : new Set([...current, ...visibleIds]),
    );
  };

  const exportEntries = () => {
    const rows = (selected.size ? entries.filter((entry) => selected.has(entry.id)) : filtered).map(
      (entry) =>
        [entry.word, entry.kana, entry.romaji, entry.jlptLevel, entry.source, entry.meanings[0]?.value ?? ""]
          .map(csvCell)
          .join(","),
    );
    const blob = new Blob([["word,kana,romaji,jlpt_level,source,meaning", ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nihongobridge-dictionary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} entries.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Dictionary manager"
        description="Search, edit, import, generate, and bulk-curate multilingual dictionary entries."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}><FileUp size={16} /> Import</Button>
            <Button variant="secondary" onClick={() => setAiOpen(true)}><Sparkles size={16} /> AI generate</Button>
            <Button onClick={() => setEditing({ ...entries[0]!, id: crypto.randomUUID(), word: "", kana: "", romaji: "", reviewStatus: "pending" })}><Plus size={16} /> New entry</Button>
          </>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <label className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search word, reading, romaji, meaning…"
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-admin"
            />
          </label>
          <select value={level} onChange={(event) => { setLevel(event.target.value as JlptLevel | "ALL"); setPage(1); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="ALL">All levels</option>{["N5", "N4", "N3", "N2", "N1", "NONE"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="ALL">All sources</option>{sources.map((value) => <option key={value}>{value}</option>)}
          </select>
          <Button variant="secondary" onClick={exportEntries}><Download size={16} /> Export</Button>
        </div>

        {selected.size ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-3">
            <span className="mr-2 text-sm font-semibold text-blue-900">{selected.size} selected</span>
            <select
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value as JlptLevel;
                if (value) { bulk([...selected], { level: value }); toast.success("JLPT level updated."); }
                event.target.value = "";
              }}
              className="h-9 rounded-lg border border-blue-200 bg-white px-2 text-xs"
            >
              <option value="" disabled>Set level…</option>{["N5","N4","N3","N2","N1","NONE"].map((value) => <option key={value}>{value}</option>)}
            </select>
            <Button size="sm" variant="secondary" onClick={() => { const tag = window.prompt("Tag to add"); if (tag) { bulk([...selected], { addTag: tag }); toast.success(`Added tag “${tag}”.`); } }}><Tag size={14} /> Add tag</Button>
            <Button size="sm" variant="danger" onClick={() => { if (window.confirm(`Delete ${selected.size} entries?`)) { bulk([...selected], { delete: true }); setSelected(new Set()); toast.success("Entries deleted and audited."); } }}><Trash2 size={14} /> Delete</Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-[.68rem] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3"><input type="checkbox" checked={visible.length > 0 && visible.every((entry) => selected.has(entry.id))} onChange={toggleAll} aria-label="Select visible entries" /></th>
                <th className="px-3 py-3">Word</th><th className="px-3 py-3">Reading</th><th className="px-3 py-3">Meaning</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Review</th><th className="w-16 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(entry.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id); return next; })} aria-label={`Select ${entry.word}`} /></td>
                  <td className="px-3 py-3"><input defaultValue={entry.word} onBlur={(event) => event.target.value !== entry.word && update(entry.id, { word: event.target.value })} className="jp-text w-28 rounded border border-transparent bg-transparent px-1 py-1 font-semibold hover:border-slate-200 focus:border-admin focus:bg-white" /></td>
                  <td className="px-3 py-3"><input defaultValue={entry.kana} onBlur={(event) => event.target.value !== entry.kana && update(entry.id, { kana: event.target.value })} className="jp-text w-32 rounded border border-transparent bg-transparent px-1 py-1 text-slate-600 hover:border-slate-200 focus:border-admin focus:bg-white" /></td>
                  <td className="max-w-60 truncate px-3 py-3 text-slate-600">{entry.meanings[0]?.value}</td>
                  <td className="px-3 py-3"><select value={entry.jlptLevel} onChange={(event) => update(entry.id, { jlptLevel: event.target.value as JlptLevel })} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold">{["N5","N4","N3","N2","N1","NONE"].map((value) => <option key={value}>{value}</option>)}</select></td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{entry.source}</span></td>
                  <td className="px-3 py-3"><ReviewBadge status={entry.reviewStatus} /></td>
                  <td className="px-3 py-3"><button type="button" onClick={() => setEditing(entry)} aria-label={`Edit ${entry.word}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-admin"><Edit3 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length ? <div className="py-16 text-center text-sm text-slate-400">No dictionary entries match these filters.</div> : null}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span>{filtered.length} results</span><div className="flex items-center gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} / {pages}</span><Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
        </div>
      </section>

      <DictionaryEditModal entry={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />
      <DictionaryImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AIGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} kind="dictionary" />
    </div>
  );
}

function ReviewBadge({ status }: { status: DictionaryAdminEntry["reviewStatus"] }) {
  const color = status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${color}`}>{status.replace("_", " ")}</span>;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
