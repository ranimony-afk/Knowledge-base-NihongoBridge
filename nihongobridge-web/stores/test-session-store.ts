import { create } from "zustand";

import type {
  LoadedSession,
} from "@/lib/api-client";
import type {
  LocalSessionSnapshot,
  SessionAnswer,
  TestQuestion,
  TestSection,
  TestType,
  JlptLevel,
} from "@/types/test";

export type AnswerSyncState = "idle" | "saving" | "saved" | "error";

interface TestSessionStore {
  sessionId: string | null;
  testId: string | null;
  level: JlptLevel | null;
  testType: TestType | null;
  sections: TestSection[];
  questionOrder: string[];
  questions: Record<string, TestQuestion>;
  currentQuestion: TestQuestion | null;
  currentQuestionIndex: number;
  answers: Record<string, SessionAnswer>;
  answerSync: Record<string, AnswerSyncState>;
  flaggedQuestions: Set<string>;
  timeElapsed: number;
  timeRemaining: number;
  totalTimeSeconds: number;
  timerPaused: boolean;
  loading: boolean;
  hydrated: boolean;
  completing: boolean;
  error: string | null;
  initialize: (loaded: LoadedSession) => void;
  restoreDraft: (snapshot: LocalSessionSnapshot) => void;
  addQuestion: (question: TestQuestion) => void;
  selectAnswer: (answer: SessionAnswer) => void;
  setAnswerSync: (questionId: string, status: AnswerSyncState) => void;
  toggleFlag: (questionId: string) => void;
  goPrevious: () => void;
  goNext: () => void;
  jumpToQuestion: (questionId: string) => void;
  tick: () => void;
  setServerTimeRemaining: (seconds: number) => void;
  setTimerPaused: (paused: boolean) => void;
  setCompleting: (completing: boolean) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  testId: null,
  level: null,
  testType: null,
  sections: [] as TestSection[],
  questionOrder: [] as string[],
  questions: {} as Record<string, TestQuestion>,
  currentQuestion: null,
  currentQuestionIndex: 0,
  answers: {} as Record<string, SessionAnswer>,
  answerSync: {} as Record<string, AnswerSyncState>,
  flaggedQuestions: new Set<string>(),
  timeElapsed: 0,
  timeRemaining: 0,
  totalTimeSeconds: 0,
  timerPaused: false,
  loading: true,
  hydrated: false,
  completing: false,
  error: null,
};

export const useTestSessionStore = create<TestSessionStore>((set, get) => ({
  ...initialState,
  initialize: ({ status, knownQuestions }) => {
    const questionOrder = status.sections.flatMap((section) => section.question_ids);
    const questions = Object.fromEntries(knownQuestions.map((question) => [question.id, question]));
    const currentQuestionIndex = status.current_question
      ? Math.max(0, questionOrder.indexOf(status.current_question.id))
      : Math.min(status.current_question_number - 1, Math.max(0, questionOrder.length - 1));
    if (status.current_question) questions[status.current_question.id] = status.current_question;
    const answers = Object.fromEntries(
      status.answers_so_far.map((answer) => [answer.question_id, answer]),
    );
    set({
      sessionId: status.session_id,
      testId: status.test_id,
      level: status.level,
      testType: status.test_type,
      sections: status.sections,
      questionOrder,
      questions,
      currentQuestion: questions[questionOrder[currentQuestionIndex] ?? ""] ?? null,
      currentQuestionIndex,
      answers,
      answerSync: Object.fromEntries(
        status.answers_so_far.map((answer) => [answer.question_id, "saved" as const]),
      ),
      flaggedQuestions: new Set(),
      timeElapsed: status.time_elapsed,
      timeRemaining: status.time_remaining,
      totalTimeSeconds: status.time_elapsed + status.time_remaining,
      timerPaused: false,
      loading: false,
      hydrated: true,
      error: null,
    });
  },
  restoreDraft: (snapshot) => {
    const state = get();
    if (!state.sessionId || snapshot.sessionId !== state.sessionId) return;
    const elapsed = Math.max(state.timeElapsed, snapshot.timeElapsed);
    const currentQuestionIndex = Math.min(
      Math.max(0, snapshot.currentQuestionIndex),
      Math.max(0, state.questionOrder.length - 1),
    );
    const restoredAnswers = { ...snapshot.answers, ...state.answers };
    const restoredSync = { ...state.answerSync };
    for (const questionId of Object.keys(snapshot.answers)) {
      if (!state.answers[questionId]) restoredSync[questionId] = "error";
    }
    set({
      answers: restoredAnswers,
      answerSync: restoredSync,
      flaggedQuestions: new Set(snapshot.flaggedQuestionIds),
      currentQuestionIndex,
      currentQuestion:
        state.questions[state.questionOrder[currentQuestionIndex] ?? ""] ??
        state.currentQuestion,
      timeElapsed: elapsed,
      timeRemaining: Math.min(
        state.timeRemaining,
        Math.max(0, state.totalTimeSeconds - elapsed),
      ),
    });
  },
  addQuestion: (question) =>
    set((state) => ({ questions: { ...state.questions, [question.id]: question } })),
  selectAnswer: (answer) =>
    set((state) => ({
      answers: { ...state.answers, [answer.question_id]: answer },
      answerSync: { ...state.answerSync, [answer.question_id]: "saving" },
    })),
  setAnswerSync: (questionId, status) =>
    set((state) => ({
      answerSync: { ...state.answerSync, [questionId]: status },
    })),
  toggleFlag: (questionId) =>
    set((state) => {
      const flaggedQuestions = new Set(state.flaggedQuestions);
      if (flaggedQuestions.has(questionId)) flaggedQuestions.delete(questionId);
      else flaggedQuestions.add(questionId);
      return { flaggedQuestions };
    }),
  goPrevious: () => {
    const state = get();
    for (let index = state.currentQuestionIndex - 1; index >= 0; index -= 1) {
      const question = state.questions[state.questionOrder[index] ?? ""];
      if (question) {
        set({ currentQuestionIndex: index, currentQuestion: question });
        return;
      }
    }
  },
  goNext: () => {
    const state = get();
    for (let index = state.currentQuestionIndex + 1; index < state.questionOrder.length; index += 1) {
      const question = state.questions[state.questionOrder[index] ?? ""];
      if (question) {
        set({ currentQuestionIndex: index, currentQuestion: question });
        return;
      }
    }
  },
  jumpToQuestion: (questionId) => {
    const state = get();
    const index = state.questionOrder.indexOf(questionId);
    const question = state.questions[questionId];
    if (index >= 0 && question) set({ currentQuestionIndex: index, currentQuestion: question });
  },
  tick: () =>
    set((state) =>
      state.timerPaused || state.timeRemaining <= 0
        ? state
        : {
            timeElapsed: state.timeElapsed + 1,
            timeRemaining: Math.max(0, state.timeRemaining - 1),
          },
    ),
  setServerTimeRemaining: (timeRemaining) =>
    set((state) => ({
      timeRemaining: Math.max(0, timeRemaining),
      timeElapsed: Math.max(state.timeElapsed, state.totalTimeSeconds - timeRemaining),
    })),
  setTimerPaused: (timerPaused) => set({ timerPaused }),
  setCompleting: (completing) => set({ completing }),
  setError: (error) => set({ error, loading: false }),
  reset: () => set({ ...initialState, flaggedQuestions: new Set() }),
}));

export function sessionSnapshot(): LocalSessionSnapshot | null {
  const state = useTestSessionStore.getState();
  if (!state.sessionId) return null;
  return {
    version: 1,
    sessionId: state.sessionId,
    answers: state.answers,
    flaggedQuestionIds: [...state.flaggedQuestions],
    currentQuestionIndex: state.currentQuestionIndex,
    timeElapsed: state.timeElapsed,
    savedAt: new Date().toISOString(),
  };
}

export function currentSection(state: Pick<TestSessionStore, "sections" | "currentQuestion">) {
  return state.sections.find((section) => section.type === state.currentQuestion?.section_type) ?? null;
}
