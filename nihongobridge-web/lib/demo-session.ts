import type { SessionStatus, TestQuestion, TestSection } from "@/types/test";

const passage =
  "<ruby>田中<rt>たなか</rt></ruby>さんは毎朝六時に起きます。朝ご飯を食べてから、駅まで歩きます。電車の中では日本語の本を読みます。今日は雨なので、傘を持って出かけました。";

function question(
  id: string,
  section: TestQuestion["section_type"],
  prompt: string,
  options: string[],
  stimulus: TestQuestion["stimulus"] = null,
): TestQuestion {
  return {
    id,
    section_type: section,
    question_jp: prompt,
    question_en: null,
    stimulus,
    options: options.map((text, index) => ({
      id: String.fromCharCode(97 + index),
      text_jp: text,
      text_en: "",
    })),
    audio_url: null,
    image_url: null,
    difficulty: 3,
    jlpt_level: "N3",
    time_limit_seconds: 45,
    tags: ["demo"],
  };
}

export const demoQuestions: TestQuestion[] = [
  question("demo-v1", "vocabulary", "「準備」の読み方として最も適切なものを選んでください。", [
    "じゅんび",
    "じゅびん",
    "じゅうび",
    "しゅんび",
  ]),
  question("demo-v2", "vocabulary", "文の意味に合う言葉を選んでください。\n旅行の＿＿＿をします。", [
    "準備",
    "約束",
    "説明",
    "経験",
  ]),
  question("demo-g1", "grammar", "文に入る最も適切な表現を選んでください。\n日本へ来て＿＿＿、毎日日本語を勉強しています。", [
    "から",
    "まで",
    "だけ",
    "ほど",
  ]),
  question("demo-g2", "grammar", "正しい文を一つ選んでください。", [
    "雨が降っても、出かけます。",
    "雨を降っても、出かけます。",
    "雨で降っても、出かけます。",
    "雨に降っても、出かけます。",
  ]),
  question("demo-r1", "reading", "田中さんは電車の中で何をしますか。", [
    "本を読みます",
    "朝ご飯を食べます",
    "傘を買います",
    "六時に寝ます",
  ], { passage_html: passage, passage }),
  question("demo-r2", "reading", "田中さんが傘を持って出かけたのはなぜですか。", [
    "雨だからです",
    "電車だからです",
    "朝早いからです",
    "本を読むからです",
  ], { passage_html: passage, passage }),
  question("demo-l1", "listening", "二人目の人が伝えた内容として最も適切なものを選んでください。", [
    "明日は九時に会います",
    "今日は九時に会います",
    "明日は会いません",
    "九時に電話します",
  ], {
    speakers: [{ name: "A" }, { name: "B" }],
    replay_limit: 2,
  }),
  question("demo-l2", "listening", "発話に対する最も自然な返事を選んでください。", [
    "はい、そうです。",
    "昨日でした。",
    "三冊です。",
    "駅にあります。",
  ], {
    speakers: [{ name: "A" }],
    replay_limit: 2,
  }),
];

export const demoSections: TestSection[] = [
  { type: "vocabulary", time_minutes: 8, question_ids: ["demo-v1", "demo-v2"] },
  { type: "grammar", time_minutes: 8, question_ids: ["demo-g1", "demo-g2"] },
  { type: "reading", time_minutes: 12, question_ids: ["demo-r1", "demo-r2"] },
  { type: "listening", time_minutes: 8, question_ids: ["demo-l1", "demo-l2"] },
];

export function demoSessionStatus(): SessionStatus {
  return {
    session_id: "demo",
    test_id: "demo-n3",
    level: "N3",
    test_type: "full_mock",
    sections: demoSections,
    status: "active",
    current_question: demoQuestions[0]!,
    current_question_number: 1,
    total_questions: demoQuestions.length,
    answers_so_far: [],
    time_elapsed: 0,
    time_remaining: demoSections.reduce((sum, section) => sum + section.time_minutes * 60, 0),
  };
}
