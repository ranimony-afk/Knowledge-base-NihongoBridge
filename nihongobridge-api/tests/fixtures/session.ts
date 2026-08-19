import type { PublicTestQuestion, TestSessionState } from "@/types/test";

export const ids = {
  session: "00000000-0000-4000-8000-000000000100",
  test: "00000000-0000-4000-8000-000000000101",
  user: "00000000-0000-4000-8000-000000000102",
  question1: "00000000-0000-4000-8000-000000000103",
  question2: "00000000-0000-4000-8000-000000000104",
};

function question(id: string): PublicTestQuestion {
  return {
    id,
    section_type: "vocabulary",
    question_jp: "読み方を選んでください。",
    question_en: "Choose a reading.",
    stimulus: null,
    options: [
      { id: "a", text_jp: "みず", text_en: "mizu" },
      { id: "b", text_jp: "ひ", text_en: "hi" },
      { id: "c", text_jp: "き", text_en: "ki" },
      { id: "d", text_jp: "ほん", text_en: "hon" },
    ],
    audio_url: null,
    image_url: null,
    difficulty: 1,
    jlpt_level: "N5",
    time_limit_seconds: 30,
    tags: [],
  };
}

export function sessionFixture(): TestSessionState {
  const questions = [question(ids.question1), question(ids.question2)];
  return {
    version: 1,
    session_id: ids.session,
    test_id: ids.test,
    user_id: ids.user,
    level: "N5",
    test_type: "section_drill",
    sections: [
      {
        type: "vocabulary",
        time_minutes: 10,
        question_ids: questions.map((item) => item.id),
      },
    ],
    questions,
    current_index: 0,
    answers: {},
    started_at: new Date(Date.now() - 10_000).toISOString(),
    deadline_at: new Date(Date.now() + 590_000).toISOString(),
    status: "active",
  };
}
