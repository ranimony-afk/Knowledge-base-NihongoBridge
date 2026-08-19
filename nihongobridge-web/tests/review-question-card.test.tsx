import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReviewQuestionCard } from "@/components/test/ReviewQuestionCard";
import { demoReviewData } from "@/lib/demo-results";

describe("ReviewQuestionCard", () => {
  it("marks correct/wrong options and toggles explanation languages", async () => {
    const user = userEvent.setup();
    const question = demoReviewData().questions.find((item) => !item.is_correct)!;
    render(
      <ReviewQuestionCard
        question={question}
        number={2}
        flagged
        onDefinition={vi.fn()}
        onAddToSrs={vi.fn()}
        onBookmark={vi.fn()}
        actionStates={{}}
      />,
    );

    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText("Correct ✓")).toBeInTheDocument();
    expect(screen.getByText("Your answer ✕")).toBeInTheDocument();
    expect(screen.getByText(question.explanation_en!)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "JP" }));
    expect(screen.getByText(question.explanation_jp!)).toBeInTheDocument();
  });
});
