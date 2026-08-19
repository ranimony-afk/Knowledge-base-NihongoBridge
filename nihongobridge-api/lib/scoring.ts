import type {
  RequestedTestType,
  ScoreSection,
  SessionAnswer,
  TestScoreResult,
  TestSectionType,
} from "@/types/test";

export interface ScorableQuestion {
  id: string;
  sectionType: TestSectionType;
  correctAnswer: string;
}

const SECTION_MAX = 60;
const SECTION_MINIMUM = 19;

function scoringGroup(section: TestSectionType): keyof TestScoreResult["score_by_section"] {
  if (section === "vocabulary") return "vocabulary";
  if (section === "listening") return "listening";
  return "grammar_reading";
}

export function calculateTestScore(
  questions: ScorableQuestion[],
  answers: Record<string, SessionAnswer>,
  testType: RequestedTestType,
): TestScoreResult {
  const counts = {
    vocabulary: { correct: 0, total: 0 },
    grammar_reading: { correct: 0, total: 0 },
    listening: { correct: 0, total: 0 },
  };
  let totalCorrect = 0;

  for (const question of questions) {
    const group = scoringGroup(question.sectionType);
    counts[group].total += 1;
    if (answers[question.id]?.selected === question.correctAnswer) {
      counts[group].correct += 1;
      totalCorrect += 1;
    }
  }

  const scoreBySection = {
    vocabulary: sectionScore(counts.vocabulary.correct, counts.vocabulary.total),
    grammar_reading: sectionScore(
      counts.grammar_reading.correct,
      counts.grammar_reading.total,
    ),
    listening: sectionScore(counts.listening.correct, counts.listening.total),
  };
  const scoreTotal = roundOne(
    scoreBySection.vocabulary.score +
      scoreBySection.grammar_reading.score +
      scoreBySection.listening.score,
  );
  const totalQuestions = questions.length;
  const accuracy = totalQuestions ? roundOne((totalCorrect / totalQuestions) * 100) : 0;
  const attemptedSections = Object.values(scoreBySection).filter((section) => section.total > 0);
  const passed =
    testType === "full_mock"
      ? scoreTotal >= 90 && attemptedSections.length === 3 && attemptedSections.every(minimumMet)
      : attemptedSections.length === 1 &&
        attemptedSections[0]!.score >= 30 &&
        attemptedSections.every(minimumMet);

  return {
    score_total: scoreTotal,
    score_by_section: scoreBySection,
    passed,
    accuracy,
    correct_answers: totalCorrect,
    total_questions: totalQuestions,
  };
}

function sectionScore(correct: number, total: number): ScoreSection {
  const score = total ? roundOne((correct / total) * SECTION_MAX) : 0;
  const minimumRequired = total ? SECTION_MINIMUM : 0;
  return {
    score,
    max_score: SECTION_MAX,
    correct,
    total,
    minimum_required: minimumRequired,
    minimum_met: total === 0 || score >= minimumRequired,
  };
}

function minimumMet(section: ScoreSection): boolean {
  return section.minimum_met;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
