import { demoQuestions, demoSections } from "@/lib/demo-session";
import type {
  CompleteResult,
  ResultPageData,
  ReviewQuestion,
  TestReviewData,
} from "@/types/results";

const result: CompleteResult = {
  score_total: 142,
  score_by_section: {
    vocabulary: {
      score: 52,
      max_score: 60,
      correct: 13,
      total: 15,
      minimum_required: 19,
      minimum_met: true,
    },
    grammar_reading: {
      score: 48,
      max_score: 60,
      correct: 16,
      total: 20,
      minimum_required: 19,
      minimum_met: true,
    },
    listening: {
      score: 42,
      max_score: 60,
      correct: 7,
      total: 10,
      minimum_required: 19,
      minimum_met: true,
    },
  },
  passed: true,
  accuracy: 78.8,
  correct_answers: 36,
  total_questions: 45,
  time_spent: 6_153,
  xp_earned: 240,
  review_url: "/api/tests/session/demo/review",
};

const choices: Record<string, string> = {
  "demo-v1": "a",
  "demo-v2": "b",
  "demo-g1": "a",
  "demo-g2": "c",
  "demo-r1": "b",
  "demo-r2": "a",
  "demo-l1": "b",
  "demo-l2": "a",
};

const explanations: Record<string, [string, string]> = {
  "demo-v1": ["「準備」は「じゅんび」と読みます。", "準備 is read じゅんび and means preparation."],
  "demo-v2": ["「旅行の準備をします」が自然な文です。", "旅行の準備をします means “I prepare for the trip.”"],
  "demo-g1": ["動作の順序には「〜てから」を使います。", "Use 〜てから to express that one action follows another."],
  "demo-g2": ["「雨が降る」は主語を「が」で示します。", "The weather expression is 雨が降る, with が marking the subject."],
  "demo-r1": ["本文には電車の中で日本語の本を読むとあります。", "The passage says Tanaka reads a Japanese book on the train."],
  "demo-r2": ["今日は雨なので傘を持って出かけました。", "Tanaka took an umbrella because it was raining."],
  "demo-l1": ["二人目の人は明日の九時に会うと言いました。", "The second speaker said they would meet tomorrow at nine."],
  "demo-l2": ["確認への自然な返事は「はい、そうです」です。", "A natural confirmation response is はい、そうです."],
};

const questions: ReviewQuestion[] = demoQuestions.map((question) => {
  const correct = "a";
  const userAnswer = choices[question.id] ?? null;
  const explanation = explanations[question.id] ?? ["答えを確認してください。", "Review the answer."];
  const sharedVocabulary = [
    {
      id: "00000000-0000-4000-8000-000000000004",
      word: "学生",
      kana: "がくせい",
      meanings: [{ lang: "en", value: "student", pos: "noun" }],
    },
  ];
  return {
    ...question,
    stimulus:
      question.section_type === "listening"
        ? {
            ...question.stimulus,
            transcript: [
              { speaker: "A", text: "明日は何時に会いますか。" },
              { speaker: "B", text: "九時に会いましょう。" },
            ],
          }
        : question.stimulus,
    correct_answer: correct,
    explanation_jp: explanation[0],
    explanation_en: explanation[1],
    user_answer: userAnswer,
    is_correct: userAnswer === correct,
    vocabulary: ["demo-v2", "demo-r1", "demo-l1"].includes(question.id)
      ? sharedVocabulary
      : [],
    grammar:
      question.section_type === "grammar"
        ? [
            {
              id: "00000000-0000-4000-8000-000000002001",
              pattern: question.id === "demo-g1" ? "〜てから" : "〜ても",
              meaning: [{ lang: "en", value: "sequence or contrast pattern" }],
            },
          ]
        : [],
  };
});

const review: TestReviewData = {
  session_id: "demo",
  test_id: "demo-n3",
  score_total: result.score_total,
  score_by_section: result.score_by_section,
  passed: result.passed,
  sections: demoSections,
  questions,
};

export function demoResultPageData(): ResultPageData {
  return {
    result,
    review,
    level: "N3",
    testType: "full_mock",
    totalTimeSeconds: demoSections.reduce(
      (sum, section) => sum + section.time_minutes * 60,
      0,
    ),
  };
}

export function demoReviewData(): TestReviewData {
  return review;
}
