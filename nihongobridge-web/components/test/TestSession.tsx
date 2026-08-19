"use client";

import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { AnswerOptions } from "@/components/test/AnswerOptions";
import { FlagButton } from "@/components/test/FlagButton";
import { ListeningQuestion } from "@/components/test/ListeningQuestion";
import { ProgressBar } from "@/components/test/ProgressBar";
import { QuestionDisplay } from "@/components/test/QuestionDisplay";
import { ReadingPassage } from "@/components/test/ReadingPassage";
import { SectionNav } from "@/components/test/SectionNav";
import { TestHeader } from "@/components/test/TestHeader";
import { useTestSession } from "@/hooks/useTestSession";
import { currentSection, useTestSessionStore } from "@/stores/test-session-store";
import type { TestQuestion } from "@/types/test";

export function TestSession({ sessionId }: { sessionId: string }) {
  const { answer, finish, reload } = useTestSession(sessionId);
  const loading = useTestSessionStore((state) => state.loading);
  const hydrated = useTestSessionStore((state) => state.hydrated);
  const error = useTestSessionStore((state) => state.error);
  const setError = useTestSessionStore((state) => state.setError);
  const question = useTestSessionStore((state) => state.currentQuestion);
  const level = useTestSessionStore((state) => state.level);
  const answers = useTestSessionStore((state) => state.answers);
  const answerSync = useTestSessionStore((state) => state.answerSync);
  const flags = useTestSessionStore((state) => state.flaggedQuestions);
  const toggleFlag = useTestSessionStore((state) => state.toggleFlag);
  const currentIndex = useTestSessionStore((state) => state.currentQuestionIndex);
  const questionOrder = useTestSessionStore((state) => state.questionOrder);
  const questions = useTestSessionStore((state) => state.questions);
  const previous = useTestSessionStore((state) => state.goPrevious);
  const next = useTestSessionStore((state) => state.goNext);
  const completing = useTestSessionStore((state) => state.completing);
  const section = useTestSessionStore(currentSection);
  const questionPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!question) return;
    questionPanelRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [question]);

  if (loading || !hydrated) {
    return <TestLoading />;
  }
  if (!question) {
    return <TestError message={error ?? "No question is available for this session."} onRetry={reload} />;
  }

  const selected = answers[question.id]?.selected;
  const sync = answerSync[question.id] ?? "idle";
  const previousAvailable = [...questionOrder.slice(0, currentIndex)].some((id) => questions[id]);
  const nextQuestionId = questionOrder[currentIndex + 1];
  const nextAvailable = Boolean(nextQuestionId && questions[nextQuestionId]);
  const finalQuestion = currentIndex >= questionOrder.length - 1;
  const canAdvance = Boolean(selected) && sync === "saved" && (nextAvailable || finalQuestion);
  const sectionPosition = section ? section.question_ids.indexOf(question.id) + 1 : currentIndex + 1;
  const content = (
    <div ref={questionPanelRef} tabIndex={-1} aria-label={`Question ${currentIndex + 1}`}>
      <QuestionBody
        question={question}
        level={level ?? "N5"}
        selected={selected}
        sync={sync}
        onAnswer={answer}
      />
    </div>
  );
  const passage = question.stimulus?.passage_html ?? question.stimulus?.passage;

  return (
    <main className="min-h-dvh bg-washi pb-24 lg:pb-8">
      <div className="mx-auto min-h-dvh max-w-[92rem] border-x border-sumi/[0.055] bg-washi/95 shadow-paper">
        <TestHeader />
        <SectionNav />
        <div className="px-4 pt-3 sm:px-6 lg:px-8">
          <ProgressBar
            current={sectionPosition}
            total={section?.question_ids.length ?? questionOrder.length}
            label="Section progress"
          />
        </div>

        {error ? (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-6 lg:mx-8">
            <AlertCircle aria-hidden className="mt-0.5 shrink-0" size={17} />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss message">
              <X aria-hidden size={16} />
            </button>
          </div>
        ) : null}

        {question.section_type === "reading" && typeof passage === "string" ? (
          <ReadingPassage passage={passage}>{content}</ReadingPassage>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-7 sm:py-10 lg:py-12">
            {content}
          </div>
        )}

        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-sumi/10 bg-washi/95 px-3 py-3 shadow-[0_-8px_30px_rgba(28,28,30,.06)] backdrop-blur-lg lg:sticky lg:mx-8 lg:mb-5 lg:rounded-2xl lg:border">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
            <button
              type="button"
              onClick={previous}
              disabled={!previousAvailable}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sumi/10 bg-white/70 px-3.5 text-sm font-semibold text-sumi/65 transition hover:border-sumi/25 hover:text-sumi disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowLeft aria-hidden size={17} />
              <span className="hidden phone:inline">Previous</span>
            </button>

            <FlagButton active={flags.has(question.id)} onToggle={() => toggleFlag(question.id)} />

            <button
              type="button"
              onClick={() => (finalQuestion ? void finish() : next())}
              disabled={!canAdvance || completing}
              className="inline-flex min-h-11 min-w-[7.5rem] items-center justify-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-35"
            >
              {completing ? (
                <><LoaderCircle className="animate-spin" aria-hidden size={17} /> Finishing…</>
              ) : finalQuestion ? (
                <><CheckCircle2 aria-hidden size={17} /> Finish</>
              ) : (
                <>Next <ArrowRight aria-hidden size={17} /></>
              )}
            </button>
          </div>
          {!selected ? (
            <p className="mt-1.5 text-center text-[0.68rem] text-sumi/40">
              Select an answer to continue. Keyboard shortcuts: 1–4.
            </p>
          ) : sync === "saving" ? (
            <p className="mt-1.5 text-center text-[0.68rem] text-sumi/40">
              Waiting for secure sync…
            </p>
          ) : null}
        </footer>
      </div>
    </main>
  );
}

function QuestionBody({
  question,
  level,
  selected,
  sync,
  onAnswer,
}: {
  question: TestQuestion;
  level: "N5" | "N4" | "N3" | "N2" | "N1";
  selected?: string | undefined;
  sync: "idle" | "saving" | "saved" | "error";
  onAnswer: (optionId: string) => void;
}) {
  return (
    <div>
      <QuestionDisplay question={question} compact={question.section_type === "reading"} />
      {question.section_type === "listening" ? (
        <div className="mt-6">
          <ListeningQuestion question={question} level={level} />
        </div>
      ) : null}
      <AnswerOptions
        questionId={question.id}
        options={question.options}
        selected={selected}
        syncState={sync}
        onSelect={onAnswer}
      />
    </div>
  );
}

function TestLoading() {
  return (
    <main className="min-h-dvh bg-washi p-4 sm:p-8" aria-busy="true" aria-label="Loading test">
      <div className="mx-auto max-w-5xl animate-pulse overflow-hidden rounded-2xl border border-sumi/10 bg-white/60 shadow-paper">
        <div className="flex justify-between border-b border-sumi/10 p-5">
          <div className="space-y-2"><div className="h-4 w-24 rounded bg-sumi/10" /><div className="h-6 w-48 rounded bg-sumi/10" /></div>
          <div className="h-10 w-28 rounded-full bg-sumi/10" />
        </div>
        <div className="space-y-5 p-6 sm:p-10">
          <div className="h-7 w-4/5 rounded bg-sumi/10" />
          <div className="h-16 rounded-xl bg-sumi/5" />
          <div className="h-16 rounded-xl bg-sumi/5" />
          <div className="h-16 rounded-xl bg-sumi/5" />
          <div className="h-16 rounded-xl bg-sumi/5" />
        </div>
      </div>
    </main>
  );
}

function TestError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-washi p-6">
      <div className="max-w-md rounded-2xl border border-sumi/10 bg-white/70 p-8 text-center shadow-paper">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-vermilion">
          <AlertCircle aria-hidden size={24} />
        </span>
        <h1 className="mt-4 text-xl font-semibold">The test could not be opened</h1>
        <p className="mt-2 text-sm leading-relaxed text-sumi/55">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-xl bg-sumi px-5 py-3 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
