import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SRSReviewCard } from "@/components/srs/SRSReviewCard";
import { demoSrsCards } from "@/lib/demo-content";

describe("SRSReviewCard", () => {
  it("requires reveal before rating and displays the next interval", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn(async () => undefined);
    render(<SRSReviewCard card={demoSrsCards[0]!} onRate={onRate} />);

    await user.click(screen.getByRole("button", { name: /Good/ }));
    expect(onRate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reveal flashcard answer" }));
    expect(screen.getByText("7 days")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Good/ }));
    expect(onRate).toHaveBeenCalledWith("good");
  });
});
