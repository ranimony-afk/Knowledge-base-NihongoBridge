"use client";

import { Check } from "lucide-react";

import { sectionLabels } from "@/lib/test-utils";
import { currentSection, useTestSessionStore } from "@/stores/test-session-store";

export function SectionNav() {
  const sections = useTestSessionStore((state) => state.sections);
  const question = useTestSessionStore((state) => state.currentQuestion);
  const answers = useTestSessionStore((state) => state.answers);
  const questions = useTestSessionStore((state) => state.questions);
  const jump = useTestSessionStore((state) => state.jumpToQuestion);
  const section = useTestSessionStore(currentSection);
  const position = section
    ? Math.max(0, section.question_ids.indexOf(question?.id ?? "")) + 1
    : 0;

  return (
    <div className="border-b border-sumi/10 bg-white/45 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-sumi/50">Section</p>
          <p className="truncate text-sm font-semibold">
            {section ? `${sectionLabels[section.type].jp} · ${sectionLabels[section.type].en}` : "—"}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-sumi/65">
          Q {position}/{section?.question_ids.length ?? 0}
        </p>
      </div>

      <nav aria-label="Test sections" className="mt-3 overflow-x-auto pb-1">
        <ol className="flex min-w-max items-center gap-1.5">
          {sections.map((item, index) => {
            const active = item.type === question?.section_type;
            const complete = item.question_ids.every((id) => Boolean(answers[id]));
            const firstLoaded = item.question_ids.find((id) => questions[id]);
            return (
              <li key={item.type} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden className="h-px w-4 bg-sumi/15 sm:w-8" /> : null}
                <button
                  type="button"
                  disabled={!firstLoaded}
                  onClick={() => firstLoaded && jump(firstLoaded)}
                  aria-current={active ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    active
                      ? "border-vermilion bg-vermilion text-white"
                      : "border-sumi/10 bg-washi text-sumi/60 hover:border-sumi/25 hover:text-sumi"
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full text-[0.58rem] ${
                      active ? "bg-white/20" : complete ? "bg-moss text-white" : "bg-sumi/8"
                    }`}
                  >
                    {complete ? <Check aria-hidden size={10} strokeWidth={3} /> : index + 1}
                  </span>
                  <span>{sectionLabels[item.type].en}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
