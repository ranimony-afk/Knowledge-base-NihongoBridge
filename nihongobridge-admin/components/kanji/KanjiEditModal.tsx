"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Upload } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormField, inputClass, textareaClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { KanjiAdminEntry } from "@/types/admin";

const jsonArray = (value: string) => {
  try { return Array.isArray(JSON.parse(value)); } catch { return false; }
};
const schema = z.object({
  onyomi: z.string(),
  kunyomi: z.string(),
  level: z.enum(["N5", "N4", "N3", "N2", "N1", "NONE"]),
  grade: z.coerce.number().int().min(1).max(9).nullable(),
  meanings: z.string().refine(jsonArray, "Enter a JSON array"),
  mnemonics: z.string().refine(jsonArray, "Enter a JSON array"),
  similar: z.string().refine(jsonArray, "Enter a JSON array"),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

export function KanjiEditModal({ entry, open, onClose }: { entry: KanjiAdminEntry | null; open: boolean; onClose: () => void }) {
  const update = useAdminStore((state) => state.updateKanji);
  const toast = useToast();
  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: formValues(entry),
  });
  useEffect(() => form.reset(formValues(entry)), [entry, form]);

  const submit = form.handleSubmit((values) => {
    if (!entry) return;
    update(entry.id, {
      onyomi: values.onyomi.split(/[、,]/).map((item) => item.trim()).filter(Boolean),
      kunyomi: values.kunyomi.split(/[、,]/).map((item) => item.trim()).filter(Boolean),
      jlptLevel: values.level,
      grade: values.grade,
      meanings: JSON.parse(values.meanings) as KanjiAdminEntry["meanings"],
      mnemonics: JSON.parse(values.mnemonics) as KanjiAdminEntry["mnemonics"],
      similarKanji: JSON.parse(values.similar) as string[],
    });
    toast.success(`${entry.character} updated and added to the audit log.`);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title={entry ? `Edit kanji ${entry.character}` : "Edit kanji"} description="Update readings, meanings, mnemonics, similar characters, and stroke media." size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-[9rem_1fr]">
          <div className="jp-text grid aspect-square place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-7xl">{entry?.character ?? "—"}</div>
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <FormField label="On'yomi"><input className={`${inputClass} jp-text`} {...form.register("onyomi")} /></FormField>
            <FormField label="Kun'yomi"><input className={`${inputClass} jp-text`} {...form.register("kunyomi")} /></FormField>
            <FormField label="JLPT level"><select className={inputClass} {...form.register("level")}>{["N5","N4","N3","N2","N1","NONE"].map((value) => <option key={value}>{value}</option>)}</select></FormField>
            <FormField label="Grade" error={form.formState.errors.grade?.message}><input type="number" className={inputClass} {...form.register("grade")} /></FormField>
          </div>
        </div>
        <FormField label="Meanings JSONB" error={form.formState.errors.meanings?.message}><textarea className={`${textareaClass} min-h-32 font-mono text-xs`} {...form.register("meanings")} /></FormField>
        <FormField label="Mnemonics JSONB" error={form.formState.errors.mnemonics?.message}><textarea className={`${textareaClass} min-h-32 font-mono text-xs`} {...form.register("mnemonics")} /></FormField>
        <FormField label="Similar kanji JSONB" error={form.formState.errors.similar?.message}><textarea className={`${textareaClass} font-mono text-xs`} {...form.register("similar")} /></FormField>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold hover:border-admin/40">
          <Upload size={17} /> Upload replacement SVG animation
          <input type="file" accept=".svg,image/svg+xml" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file && entry) { update(entry.id, { svgUrl: URL.createObjectURL(file) }); toast.success("SVG attached to the kanji draft."); } }} />
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit"><Save size={16} /> Save kanji</Button></div>
      </form>
    </Modal>
  );
}

function formValues(entry: KanjiAdminEntry | null): Values {
  return {
    onyomi: entry?.onyomi.join("、") ?? "",
    kunyomi: entry?.kunyomi.join("、") ?? "",
    level: entry?.jlptLevel ?? "NONE",
    grade: entry?.grade ?? null,
    meanings: JSON.stringify(entry?.meanings ?? [], null, 2),
    mnemonics: JSON.stringify(entry?.mnemonics ?? [], null, 2),
    similar: JSON.stringify(entry?.similarKanji ?? [], null, 2),
  };
}
