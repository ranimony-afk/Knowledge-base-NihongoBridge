"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormField, inputClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { DictionaryAdminEntry } from "@/types/admin";

const schema = z.object({
  word: z.string().min(1),
  kana: z.string().optional(),
  meaning: z.string().min(1),
  level: z.string().optional(),
});
type Mapping = z.infer<typeof schema>;

export function DictionaryImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const importEntries = useAdminStore((state) => state.importDictionary);
  const toast = useToast();
  const form = useForm<Mapping>({
    resolver: zodResolver(schema),
    defaultValues: { word: "word", kana: "kana", meaning: "meaning", level: "level" },
  });
  const preview = useMemo(() => rows.slice(0, 3), [rows]);

  const readFile = async (file: File) => {
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) throw new Error("JSON import must be an array");
      const objects = parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
      setRows(objects);
      setHeaders(Object.keys(objects[0] ?? {}));
    } else {
      const [head = "", ...lines] = text.split(/\r?\n/).filter(Boolean);
      const fields = splitCsv(head);
      setHeaders(fields);
      setRows(
        lines.map((line) =>
          Object.fromEntries(splitCsv(line).map((value, index) => [fields[index] ?? `field_${index}`, value])),
        ),
      );
    }
  };

  const submit = form.handleSubmit((values) => {
    const entries: DictionaryAdminEntry[] = rows.map((row, index) => {
      const word = String(row[values.word] ?? "").trim();
      const meaning = String(row[values.meaning] ?? "").trim();
      const level = String(row[values.level ?? ""] ?? "NONE");
      return {
        id: crypto.randomUUID(),
        word,
        kana: String(row[values.kana ?? ""] ?? ""),
        romaji: "",
        meanings: [{ lang: "en", value: meaning, pos: "unclassified" }],
        furigana: [],
        pitchAccent: null,
        synonyms: [],
        antonyms: [],
        exampleSentenceIds: [],
        grammarIds: [],
        kanjiIds: [...word].filter((character) => /[一-龯]/.test(character)),
        jlptLevel: isLevel(level) ? level : "NONE",
        partOfSpeech: ["unclassified"],
        frequencyRank: null,
        tags: ["imported"],
        source: "custom",
        audioUrl: null,
        isActive: true,
        reviewStatus: "pending" as const,
        updatedAt: new Date(Date.now() + index).toISOString(),
      };
    }).filter((entry) => entry.word && entry.meanings[0]?.value);
    importEntries(entries);
    toast.success(`Imported ${entries.length} dictionary entries for review.`);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title="Import dictionary data" description="Upload CSV or JSON, then map source columns to NihongoBridge fields." size="lg">
      <form onSubmit={submit} className="space-y-5">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center hover:border-admin/40">
          <FileUp size={28} className="text-admin" />
          <span className="mt-3 text-sm font-semibold">Choose CSV or JSON</span>
          <span className="mt-1 text-xs text-slate-400">Files are parsed locally for preview.</span>
          <input
            type="file"
            accept=".csv,.json,application/json,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Import failed"));
            }}
          />
        </label>

        {headers.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              {(["word", "kana", "meaning", "level"] as const).map((field) => (
                <FormField key={field} label={`${field} column`} error={form.formState.errors[field]?.message}>
                  <select className={inputClass} {...form.register(field)}>
                    <option value="">Not mapped</option>
                    {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </FormField>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr></thead>
                <tbody>{preview.map((row, index) => <tr key={index} className="border-t border-slate-100">{headers.map((header) => <td key={header} className="max-w-48 truncate px-3 py-2">{String(row[header] ?? "")}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">{rows.length} rows detected. Previewing {preview.length}.</p>
          </>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!rows.length}><Upload size={16} /> Import {rows.length || ""}</Button>
        </div>
      </form>
    </Modal>
  );
}

function splitCsv(line: string): string[] {
  return line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((value) => value.trim().replace(/^\"|\"$/g, ""));
}

function isLevel(value: string): value is DictionaryAdminEntry["jlptLevel"] {
  return ["N5", "N4", "N3", "N2", "N1", "NONE"].includes(value);
}
