import type { SectionType, TestType } from "@/types/test";

export const sectionLabels: Record<SectionType, { en: string; jp: string }> = {
  vocabulary: { en: "Vocabulary", jp: "文字・語彙" },
  grammar: { en: "Grammar", jp: "文法" },
  reading: { en: "Reading", jp: "読解" },
  listening: { en: "Listening", jp: "聴解" },
};

export function testTypeLabel(type: TestType | null): string {
  return type === "section_drill" ? "Section Drill" : "Mock Test";
}

export function formatTime(totalSeconds: number): string {
  const value = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(value / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  const seconds = value % 60;
  return hours > 0
    ? [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":")
    : [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
