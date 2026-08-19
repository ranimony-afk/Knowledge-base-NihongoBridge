"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormField, inputClass, textareaClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { DictionaryAdminEntry } from "@/types/admin";

const schema = z.object({
  word: z.string().trim().min(1),
  kana: z.string(),
  romaji: z.string(),
  jlptLevel: z.enum(["N5", "N4", "N3", "N2", "N1", "NONE"]),
  source: z.string().trim().min(1),
  frequencyRank: z.coerce.number().int().positive().nullable(),
  audioUrl: z.string().url().or(z.literal("")).nullable(),
  meaningsJson: z.string().refine(jsonArray, "Meanings must be a JSON array"),
  furiganaJson: z.string().refine(jsonArray, "Furigana must be a JSON array"),
  pitchAccentJson: z.string().refine(validJson, "Pitch accent must be valid JSON"),
  relationsJson: z.string().refine(validRelations, "Relations must contain UUID arrays"),
  posJson: z.string().refine(jsonArray, "Part of speech must be a JSON array"),
  tagsJson: z.string().refine(jsonArray, "Tags must be a JSON array"),
  isActive: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function DictionaryEditModal({
  entry,
  open,
  onClose,
}: {
  entry: DictionaryAdminEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  const update = useAdminStore((state) => state.updateDictionary);
  const importEntries = useAdminStore((state) => state.importDictionary);
  const toast = useToast();
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: values(entry),
  });

  useEffect(() => form.reset(values(entry)), [entry, form]);

  const submit = form.handleSubmit((data) => {
    if (!entry) return;
    const changes: Partial<DictionaryAdminEntry> = {
      word: data.word,
      kana: data.kana,
      romaji: data.romaji,
      jlptLevel: data.jlptLevel,
      source: data.source,
      frequencyRank: data.frequencyRank,
      audioUrl: data.audioUrl || null,
      meanings: JSON.parse(data.meaningsJson) as DictionaryAdminEntry["meanings"],
      furigana: JSON.parse(data.furiganaJson) as DictionaryAdminEntry["furigana"],
      pitchAccent: JSON.parse(data.pitchAccentJson) as unknown,
      ...relations(JSON.parse(data.relationsJson) as Record<string, unknown>),
      partOfSpeech: JSON.parse(data.posJson) as string[],
      tags: JSON.parse(data.tagsJson) as string[],
      isActive: data.isActive,
    };
    const exists = useAdminStore.getState().dictionary.some((item) => item.id === entry.id);
    if (exists) update(entry.id, changes);
    else importEntries([{ ...entry, ...changes, updatedAt: new Date().toISOString() }]);
    toast.success(`${data.word} updated and audited.`);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title={entry ? `Edit ${entry.word}` : "Edit entry"} description="Full editor including JSONB-backed arrays." size="xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Word" htmlFor="word" error={form.formState.errors.word?.message}>
            <input id="word" className={`${inputClass} jp-text`} {...form.register("word")} />
          </FormField>
          <FormField label="Kana" htmlFor="kana">
            <input id="kana" className={`${inputClass} jp-text`} {...form.register("kana")} />
          </FormField>
          <FormField label="Romaji" htmlFor="romaji">
            <input id="romaji" className={inputClass} {...form.register("romaji")} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField label="JLPT level" htmlFor="level">
            <select id="level" className={inputClass} {...form.register("jlptLevel")}>
              {['N5','N4','N3','N2','N1','NONE'].map((level) => <option key={level}>{level}</option>)}
            </select>
          </FormField>
          <FormField label="Source" htmlFor="source">
            <input id="source" className={inputClass} {...form.register("source")} />
          </FormField>
          <FormField label="Frequency rank" htmlFor="rank">
            <input id="rank" type="number" className={inputClass} {...form.register("frequencyRank")} />
          </FormField>
          <FormField label="Status">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm">
              <input type="checkbox" {...form.register("isActive")} /> Active
            </label>
          </FormField>
        </div>
        <FormField label="Audio URL" htmlFor="audio" error={form.formState.errors.audioUrl?.message}>
          <input id="audio" className={inputClass} {...form.register("audioUrl")} />
        </FormField>
        <div className="grid gap-4 lg:grid-cols-2">
          <FormField label="Meanings JSONB" htmlFor="meanings" error={form.formState.errors.meaningsJson?.message}>
            <textarea id="meanings" className={`${textareaClass} min-h-48 font-mono text-xs`} {...form.register("meaningsJson")} />
          </FormField>
          <div className="space-y-4">
            <FormField label="Part of speech JSONB" htmlFor="pos" error={form.formState.errors.posJson?.message}>
              <textarea id="pos" className={`${textareaClass} font-mono text-xs`} {...form.register("posJson")} />
            </FormField>
            <FormField label="Tags JSONB" htmlFor="tags" error={form.formState.errors.tagsJson?.message}>
              <textarea id="tags" className={`${textareaClass} font-mono text-xs`} {...form.register("tagsJson")} />
            </FormField>
          </div>
        </div>
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-bold">Advanced JSONB and relation fields</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <FormField label="Furigana JSONB" error={form.formState.errors.furiganaJson?.message}>
              <textarea className={`${textareaClass} min-h-40 font-mono text-xs`} {...form.register("furiganaJson")} />
            </FormField>
            <FormField label="Pitch accent JSONB" error={form.formState.errors.pitchAccentJson?.message}>
              <textarea className={`${textareaClass} min-h-40 font-mono text-xs`} {...form.register("pitchAccentJson")} />
            </FormField>
            <FormField label="Relations JSONB" error={form.formState.errors.relationsJson?.message} hint="synonyms, antonyms, sentences, grammar, kanji">
              <textarea className={`${textareaClass} min-h-40 font-mono text-xs`} {...form.register("relationsJson")} />
            </FormField>
          </div>
        </details>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit"><Save size={16} /> Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

function values(entry: DictionaryAdminEntry | null): FormValues {
  return {
    word: entry?.word ?? "",
    kana: entry?.kana ?? "",
    romaji: entry?.romaji ?? "",
    jlptLevel: entry?.jlptLevel ?? "NONE",
    source: entry?.source ?? "custom",
    frequencyRank: entry?.frequencyRank ?? null,
    audioUrl: entry?.audioUrl ?? "",
    meaningsJson: JSON.stringify(entry?.meanings ?? [], null, 2),
    furiganaJson: JSON.stringify(entry?.furigana ?? [], null, 2),
    pitchAccentJson: JSON.stringify(entry?.pitchAccent ?? null, null, 2),
    relationsJson: JSON.stringify(
      {
        synonyms: entry?.synonyms ?? [],
        antonyms: entry?.antonyms ?? [],
        exampleSentenceIds: entry?.exampleSentenceIds ?? [],
        grammarIds: entry?.grammarIds ?? [],
        kanjiIds: entry?.kanjiIds ?? [],
      },
      null,
      2,
    ),
    posJson: JSON.stringify(entry?.partOfSpeech ?? [], null, 2),
    tagsJson: JSON.stringify(entry?.tags ?? [], null, 2),
    isActive: entry?.isActive ?? true,
  };
}

function jsonArray(value: string): boolean {
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

function validJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function validRelations(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return ["synonyms", "antonyms", "exampleSentenceIds", "grammarIds", "kanjiIds"].every(
      (key) => Array.isArray(parsed[key]),
    );
  } catch {
    return false;
  }
}

function relations(value: Record<string, unknown>): Pick<
  DictionaryAdminEntry,
  "synonyms" | "antonyms" | "exampleSentenceIds" | "grammarIds" | "kanjiIds"
> {
  return {
    synonyms: value.synonyms as string[],
    antonyms: value.antonyms as string[],
    exampleSentenceIds: value.exampleSentenceIds as string[],
    grammarIds: value.grammarIds as string[],
    kanjiIds: value.kanjiIds as string[],
  };
}
