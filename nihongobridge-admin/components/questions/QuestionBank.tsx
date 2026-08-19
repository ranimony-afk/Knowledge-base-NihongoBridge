"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Search,
  Sparkles,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/admin/PageHeader";
import { AIGenerateModal } from "@/components/forms/AIGenerateModal";
import { FormField, inputClass, textareaClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { QuestionAdminEntry } from "@/types/admin";

const schema = z.object({
  questionJp: z.string().min(2),
  questionEn: z.string(),
  level: z.enum(["N5", "N4", "N3", "N2", "N1"]),
  sectionType: z.enum(["vocabulary", "grammar", "reading", "listening"]),
  difficulty: z.coerce.number().int().min(1).max(5),
  correctAnswer: z.string().min(1),
  explanationEn: z.string().min(3),
  optionsJson: z.string().refine((value) => {
    try { return Array.isArray(JSON.parse(value)) && JSON.parse(value).length === 4; } catch { return false; }
  }, "Enter a JSON array with four options"),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

export function QuestionBank() {
  const questions = useAdminStore((state) => state.questions);
  const update = useAdminStore((state) => state.updateQuestion);
  const bulk = useAdminStore((state) => state.bulkQuestions);
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("ALL");
  const [level, setLevel] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [difficulty, setDifficulty] = useState("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<QuestionAdminEntry | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const filtered = useMemo(
    () =>
      questions.filter((item) =>
        (!query || item.questionJp.toLowerCase().includes(query.toLowerCase())) &&
        (section === "ALL" || item.sectionType === section) &&
        (level === "ALL" || item.level === level) &&
        (source === "ALL" || item.source === source) &&
        (difficulty === "ALL" || item.difficulty === Number(difficulty)),
      ),
    [difficulty, level, query, questions, section, source],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assessment"
        title="Question bank"
        description="Review generated quality, edit question structure, and curate batches by section, level, and difficulty."
        actions={<Button onClick={() => setAiOpen(true)}><Sparkles size={16} /> AI generate</Button>}
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-[1fr_repeat(4,auto)]">
          <label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search question text…" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></label>
          <Filter value={section} onChange={setSection} label="section" options={["vocabulary","grammar","reading","listening"]} />
          <Filter value={level} onChange={setLevel} label="level" options={["N5","N4","N3","N2","N1"]} />
          <Filter value={source} onChange={setSource} label="source" options={["original","generated"]} />
          <Filter value={difficulty} onChange={setDifficulty} label="difficulty" options={["1","2","3","4","5"]} />
        </div>

        {selected.size ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 p-3">
            <span className="mr-2 text-sm font-bold text-blue-900">{selected.size} selected</span>
            <select defaultValue="" onChange={(event) => { if (event.target.value) bulk([...selected], { level: event.target.value as QuestionAdminEntry["level"] }); event.target.value = ""; }} className="h-9 rounded-lg border border-blue-200 bg-white px-2 text-xs"><option value="" disabled>Set level…</option>{["N5","N4","N3","N2","N1"].map((item) => <option key={item}>{item}</option>)}</select>
            <Button size="sm" variant="secondary" onClick={() => { const tag = window.prompt("Tag to add"); if (tag) { bulk([...selected], { addTag: tag }); toast.success("Tags updated."); } }}><Tag size={14} /> Add tag</Button>
            <Button size="sm" variant="secondary" onClick={() => { [...selected].forEach((id) => update(id, { reviewStatus: "approved" })); toast.success("Questions approved."); }}><CheckCircle2 size={14} /> Approve</Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-[.68rem] uppercase tracking-wider text-slate-500"><tr><th className="w-12 px-4 py-3" /><th className="px-3 py-3">Question</th><th className="px-3 py-3">Section</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Difficulty</th><th className="px-3 py-3">Quality</th><th className="px-3 py-3">Review</th><th className="w-12" /></tr></thead>
            <tbody>{filtered.map((item) => <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3"><input type="checkbox" checked={selected.has(item.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })} aria-label={`Select question ${item.id}`} /></td><td className="max-w-md px-3 py-3"><p className="jp-text line-clamp-2 font-medium leading-relaxed">{item.questionJp}</p><p className="mt-1 truncate text-xs text-slate-400">{item.tags.join(" · ")}</p></td><td className="px-3 py-3 capitalize">{item.sectionType}</td><td className="px-3 py-3 font-bold">{item.level}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{item.source}</span></td><td className="px-3 py-3"><span className="font-semibold">{item.difficulty}/5</span></td><td className="px-3 py-3"><Quality confidence={item.confidence} /></td><td className="px-3 py-3"><Review status={item.reviewStatus} /></td><td className="px-3 py-3"><button type="button" onClick={() => setEditing(item)} aria-label="Edit question" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-admin"><Edit3 size={15} /></button></td></tr>)}</tbody>
          </table>
        </div>
        {!filtered.length ? <div className="py-16 text-center text-sm text-slate-400">No questions match these filters.</div> : null}
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">{filtered.length} questions · {questions.filter((item) => item.confidence < .6).length} low-confidence</div>
      </section>

      <QuestionEditModal question={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />
      <AIGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} kind="questions" />
    </div>
  );
}

function QuestionEditModal({ question, open, onClose }: { question: QuestionAdminEntry | null; open: boolean; onClose: () => void }) {
  const update = useAdminStore((state) => state.updateQuestion);
  const toast = useToast();
  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    values: values(question),
  });
  const submit = form.handleSubmit((data) => {
    if (!question) return;
    const { optionsJson, ...changes } = data;
    update(question.id, {
      ...changes,
      difficulty: changes.difficulty as QuestionAdminEntry["difficulty"],
      options: JSON.parse(optionsJson) as QuestionAdminEntry["options"],
    });
    toast.success("Question saved and audited.");
    onClose();
  });
  return <Modal open={open} onClose={onClose} title="Edit question" description="Answer and explanation fields are visible only in admin and review mode." size="xl"><form onSubmit={submit} className="space-y-4"><FormField label="Japanese prompt" error={form.formState.errors.questionJp?.message}><textarea className={`${textareaClass} jp-text`} {...form.register("questionJp")} /></FormField><FormField label="English prompt"><input className={inputClass} {...form.register("questionEn")} /></FormField><div className="grid gap-4 sm:grid-cols-4"><FormField label="Section"><select className={inputClass} {...form.register("sectionType")}>{["vocabulary","grammar","reading","listening"].map((item) => <option key={item}>{item}</option>)}</select></FormField><FormField label="Level"><select className={inputClass} {...form.register("level")}>{["N5","N4","N3","N2","N1"].map((item) => <option key={item}>{item}</option>)}</select></FormField><FormField label="Difficulty"><input type="number" className={inputClass} {...form.register("difficulty")} /></FormField><FormField label="Correct option"><input className={inputClass} {...form.register("correctAnswer")} /></FormField></div><FormField label="Options JSON" error={form.formState.errors.optionsJson?.message}><textarea className={`${textareaClass} min-h-48 font-mono text-xs`} {...form.register("optionsJson")} /></FormField><FormField label="Explanation" error={form.formState.errors.explanationEn?.message}><textarea className={textareaClass} {...form.register("explanationEn")} /></FormField><div className="flex justify-end gap-2 pt-3"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save question</Button></div></form></Modal>;
}

function values(item: QuestionAdminEntry | null): Values {
  return { questionJp: item?.questionJp ?? "", questionEn: item?.questionEn ?? "", level: item?.level ?? "N3", sectionType: item?.sectionType ?? "vocabulary", difficulty: item?.difficulty ?? 3, correctAnswer: item?.correctAnswer ?? "a", explanationEn: item?.explanationEn ?? "", optionsJson: JSON.stringify(item?.options ?? [], null, 2) };
}
function Filter({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: string[] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs capitalize"><option value="ALL">All {label}s</option>{options.map((item) => <option key={item}>{item}</option>)}</select>;
}
function Quality({ confidence }: { confidence: number }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${confidence < .6 ? "bg-red-50 text-red-700" : confidence < .8 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{confidence < .6 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}{Math.round(confidence * 100)}%</span>;
}
function Review({ status }: { status: QuestionAdminEntry["reviewStatus"] }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{status.replace("_", " ")}</span>;
}
