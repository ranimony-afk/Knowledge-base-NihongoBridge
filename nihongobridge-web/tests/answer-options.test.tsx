import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnswerOptions } from "@/components/test/AnswerOptions";

const options = ["水", "火", "木", "本"].map((text, index) => ({
  id: String.fromCharCode(97 + index),
  text_jp: text,
  text_en: "",
}));

describe("AnswerOptions", () => {
  it("supports accessible radio selection and keyboard keys 1-4", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <AnswerOptions questionId="q1" options={options} onSelect={onSelect} />,
    );

    await user.keyboard("2");
    expect(onSelect).toHaveBeenCalledWith("b");

    rerender(
      <AnswerOptions
        questionId="q1"
        options={options}
        selected="b"
        syncState="saved"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("radio", { name: /火/ })).toBeChecked();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
