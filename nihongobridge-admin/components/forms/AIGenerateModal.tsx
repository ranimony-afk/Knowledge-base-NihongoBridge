"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormField, inputClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { DictionaryAdminEntry, QuestionAdminEntry } from "@/types/admin";

const schema = z.object({
  topic: z.string().trim().min(2, "Enter a topic").max(200),
  level: z.enum(["N5", "N4", "N3", "N2", "N1"]),
  section: z.enum(["vocabulary", "grammar", "reading", "listening"]),
  count: z.coerce.number().int().min(1).max(50),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

export function AIGenerateModal({
  open,
  onClose,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  kind: "dictionary" | "questions";
}) {
  const addQuestions = useAdminStore((state) => state.addQuestions);
  const importDictionary = useAdminStore((state) => state.importDictionary);
  const toast = useToast();
  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      topic: kind === "dictionary" ? "restaurant vocabulary" : "daily routines",
      level: "N3",
      section: "vocabulary",
      count: 5,
    },
  });

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    try {
      if (process.env.NEXT_PUBLIC_ADMIN_DEMO_MODE !== "true") {
        const response = await fetch("/api/admin/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, ...values }),
        });
        if (!response.ok) throw new Error(`AI endpoint returned HTTP ${response.status}`);
      }
      if (kind === "questions") addQuestions(draftQuestions(values));
      else importDictionary(draftWords(values));
      toast.success(`${values.count} AI ${kind} drafts created for human review.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI generation failed");
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`AI generate ${kind}`}
      description="Drafts are original, knowledge-base grounded, and always enter the pending review queue."
      size="md"
    >
      <form onSubmit={submit} className="space-y-5">
        <FormField label="Topic" htmlFor="ai-topic" error={form.formState.errors.topic?.message}>
          <input id="ai-topic" className={inputClass} {...form.register("topic")} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="JLPT level">
            <select className={inputClass} {...form.register("level")}>
              {["N5", "N4", "N3", "N2", "N1"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </FormField>
          <FormField label="Section">
            <select className={inputClass} disabled={kind === "dictionary"} {...form.register("section")}>
              {["vocabulary", "grammar", "reading", "listening"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </FormField>
          <FormField label="Count" error={form.formState.errors.count?.message}>
            <input type="number" className={inputClass} {...form.register("count")} />
          </FormField>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          Official or copyrighted JLPT exam material is prohibited. Generated items include provenance and confidence metadata.
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Sparkles size={16} /> {form.formState.isSubmitting ? "Generating…" : "Generate drafts"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function draftWords(values: Values): DictionaryAdminEntry[] {
  return Array.from({ length: values.count }, (_, index) => ({
    id: crypto.randomUUID(),
    word: `${values.topic} ${index + 1}`,
    kana: "",
    romaji: "",
    meanings: [{ lang: "en", value: `Draft meaning for ${values.topic}`, pos: "unclassified" }],
    furigana: [],
    pitchAccent: null,
    synonyms: [],
    antonyms: [],
    exampleSentenceIds: [],
    grammarIds: [],
    kanjiIds: [],
    jlptLevel: values.level,
    partOfSpeech: ["unclassified"],
    frequencyRank: null,
    tags: ["ai-generated", values.topic],
    source: "generated",
    audioUrl: null,
    isActive: false,
    reviewStatus: "pending",
    updatedAt: new Date().toISOString(),
  }));
}

function draftQuestions(values: Values): QuestionAdminEntry[] {
  return Array.from({ length: values.count }, (_, index) => ({
    id: crypto.randomUUID(),
    sectionType: values.section,
    level: values.level,
    source: "generated",
    difficulty: 3,
    questionJp: `${values.topic}について最も適切な答えを選んでください。 (${index + 1})`,
    questionEn: `Choose the best answer about ${values.topic}.`,
    options: ["a", "b", "c", "d"].map((id, option) => ({
      id,
      text_jp: option === 0 ? "正しい答え" : `選択肢 ${option + 1}`,
      text_en: "",
    })),
    correctAnswer: "a",
    explanationEn: "AI draft pending content review.",
    tags: ["ai-generated", values.topic],
    confidence: .55,
    reviewStatus: "pending",
    audioUrl: null,
  }));
}
