"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/admin/PageHeader";
import { FormField, inputClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { PracticeTestAdmin, QuestionAdminEntry } from "@/types/admin";

const formSchema = z.object({
  title: z.string().min(3),
  level: z.enum(["N5", "N4", "N3", "N2", "N1"]),
  testType: z.enum(["mock_full", "section_only", "quick_drill", "adaptive"]),
});
type FormValues = z.infer<typeof formSchema>;

export function TestManager() {
  const tests = useAdminStore((state) => state.tests);
  const questions = useAdminStore((state) => state.questions);
  const updateTest = useAdminStore((state) => state.updateTest);
  const reorder = useAdminStore((state) => state.reorderTestQuestions);
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(tests[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const selected = tests.find((item) => item.id === selectedId) ?? tests[0];
  const selectedQuestions = selected
    ? selected.questionIds.map((id) => questions.find((question) => question.id === id)).filter(isQuestion)
    : [];
  const bank = useMemo(
    () =>
      questions.filter(
        (question) =>
          (!selected?.questionIds.includes(question.id)) &&
          (!query || question.questionJp.toLowerCase().includes(query.toLowerCase())),
      ),
    [query, questions, selected?.questionIds],
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dragEnd = (event: DragEndEvent) => {
    if (!selected || !event.over || event.active.id === event.over.id) return;
    const oldIndex = selected.questionIds.indexOf(String(event.active.id));
    const newIndex = selected.questionIds.indexOf(String(event.over.id));
    reorder(selected.id, arrayMove(selected.questionIds, oldIndex, newIndex));
    toast.success("Question order updated.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assessment"
        title="Test manager"
        description="Publish tests, assemble sections from the question bank, preview the student experience, and monitor outcomes."
        actions={<Button onClick={() => setCreating(true)}><Plus size={16} /> Create test</Button>}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[22rem_1fr]">
        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {tests.map((test) => (
            <button key={test.id} type="button" onClick={() => setSelectedId(test.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === test.id ? "border-admin bg-red-50/50" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[.65rem] font-bold">{test.level}</span><Status published={test.isPublished} /></div>
              <h2 className="mt-3 text-sm font-bold">{test.title}</h2>
              <p className="mt-2 text-xs text-slate-500">{test.questionIds.length} questions · {test.attempts.toLocaleString()} attempts</p>
            </button>
          ))}
        </aside>

        {selected ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-start">
              <div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{selected.level}</span><Status published={selected.isPublished} /></div><h2 className="mt-3 text-xl font-bold">{selected.title}</h2><p className="mt-1 text-xs text-slate-500 capitalize">{selected.testType.replace("_", " ")}</p></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</Button><Button size="sm" variant="secondary" onClick={() => setPreview(true)}><Eye size={14} /> Preview</Button><Button size="sm" onClick={() => { updateTest(selected.id, { isPublished: !selected.isPublished }); toast.success(selected.isPublished ? "Test unpublished." : "Test published."); }}><Send size={14} /> {selected.isPublished ? "Unpublish" : "Publish"}</Button></div>
            </header>

            <div className="grid gap-0 lg:grid-cols-[1fr_22rem]">
              <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">Test questions</h3><p className="text-xs text-slate-500">Drag to reorder</p></div><span className="text-xs font-semibold text-slate-400">{selectedQuestions.length}</span></div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
                  <SortableContext items={selected.questionIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">{selectedQuestions.map((question, index) => <SortableQuestion key={question.id} question={question} index={index} onRemove={() => { reorder(selected.id, selected.questionIds.filter((id) => id !== question.id)); toast.success("Question removed from test."); }} />)}</div>
                  </SortableContext>
                </DndContext>
                {!selectedQuestions.length ? <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">Add questions from the bank.</div> : null}
              </div>

              <aside className="p-4">
                <h3 className="font-bold">Question bank</h3>
                <label className="relative mt-3 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions…" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-2 text-xs" /></label>
                <div className="admin-scrollbar mt-3 max-h-[36rem] space-y-2 overflow-y-auto pr-1">{bank.slice(0, 20).map((question) => <div key={question.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[.6rem] font-bold uppercase">{question.sectionType}</span><span className="text-[.6rem] text-slate-400">D{question.difficulty}</span></div><p className="jp-text mt-2 line-clamp-2 text-xs leading-relaxed">{question.questionJp}</p><Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => { reorder(selected.id, [...selected.questionIds, question.id]); toast.success("Question added to test."); }}><Plus size={13} /> Add</Button></div>)}</div>
              </aside>
            </div>

            <footer className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
              <Analytics label="Completion rate" value={`${selected.completionRate}%`} />
              <Analytics label="Average score" value={`${selected.averageScore}/${selected.testType === "mock_full" ? 180 : 60}`} />
              <Analytics label="Total attempts" value={selected.attempts.toLocaleString()} />
            </footer>
          </section>
        ) : null}
      </div>

      <TestEditModal test={selected ?? null} open={editing} onClose={() => setEditing(false)} />
      <TestEditModal test={null} open={creating} onClose={() => setCreating(false)} onCreated={setSelectedId} />
      <Modal open={preview} onClose={() => setPreview(false)} title="Student preview" description="Answer keys are hidden in this view." size="lg">
        {selectedQuestions[0] ? <div className="rounded-2xl border border-slate-200 bg-paper p-6"><p className="text-xs font-bold uppercase text-admin">Question 1 · {selectedQuestions[0].sectionType}</p><p className="jp-text mt-5 text-xl font-semibold">{selectedQuestions[0].questionJp}</p><div className="mt-6 grid gap-2">{selectedQuestions[0].options.map((option) => <div key={option.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 jp-text">{option.text_jp}</div>)}</div></div> : <p>No questions to preview.</p>}
      </Modal>
    </div>
  );
}

function SortableQuestion({ question, index, onRemove }: { question: QuestionAdminEntry; index: number; onRemove: () => void }) {
  const sortable = useSortable({ id: question.id });
  return (
    <div ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 ${sortable.isDragging ? "z-20 shadow-xl" : ""}`}>
      <button type="button" {...sortable.attributes} {...sortable.listeners} aria-label="Drag question" className="mt-1 cursor-grab text-slate-300 active:cursor-grabbing"><GripVertical size={17} /></button>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold">{index + 1}</span>
      <div className="min-w-0 flex-1"><div className="flex gap-2"><span className="text-[.6rem] font-bold uppercase text-admin">{question.sectionType}</span><span className="text-[.6rem] text-slate-400">{question.level} · D{question.difficulty}</span></div><p className="jp-text mt-1 line-clamp-2 text-sm">{question.questionJp}</p></div>
      <button type="button" onClick={onRemove} aria-label="Remove question" className="text-slate-300 hover:text-red-600"><Trash2 size={15} /></button>
    </div>
  );
}

function TestEditModal({
  test,
  open,
  onClose,
  onCreated,
}: {
  test: PracticeTestAdmin | null;
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const add = useAdminStore((state) => state.addTest);
  const update = useAdminStore((state) => state.updateTest);
  const toast = useToast();
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), values: { title: test?.title ?? "New practice test", level: test?.level ?? "N3", testType: test?.testType ?? "mock_full" } });
  const submit = form.handleSubmit((values) => {
    if (test) {
      update(test.id, values);
    } else {
      const id = crypto.randomUUID();
      add({
        id,
        ...values,
        isPublished: false,
        questionIds: [],
        completionRate: 0,
        averageScore: 0,
        attempts: 0,
        updatedAt: new Date().toISOString(),
      });
      onCreated?.(id);
    }
    toast.success(`Test ${test ? "settings saved" : "created"} and audited.`);
    onClose();
  });
  return <Modal open={open} onClose={onClose} title="Test settings" size="md"><form onSubmit={submit} className="space-y-4"><FormField label="Title" error={form.formState.errors.title?.message}><input className={inputClass} {...form.register("title")} /></FormField><div className="grid grid-cols-2 gap-4"><FormField label="Level"><select className={inputClass} {...form.register("level")}>{["N5","N4","N3","N2","N1"].map((item) => <option key={item}>{item}</option>)}</select></FormField><FormField label="Type"><select className={inputClass} {...form.register("testType")}>{["mock_full","section_only","quick_drill","adaptive"].map((item) => <option key={item}>{item}</option>)}</select></FormField></div><div className="flex justify-end gap-2 pt-3"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></Modal>;
}

function Status({ published }: { published: boolean }) {
  return <span className={`rounded-full px-2 py-1 text-[.65rem] font-bold ${published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{published ? "Published" : "Draft"}</span>;
}
function Analytics({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white px-3 py-2"><p className="text-[.62rem] uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-bold tabular-nums">{value}</p></div>;
}
function isQuestion(value: QuestionAdminEntry | undefined): value is QuestionAdminEntry { return Boolean(value); }
