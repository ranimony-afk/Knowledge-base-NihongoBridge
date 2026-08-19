import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { QuickDrillMode } from "@/components/test/QuickDrillMode";

const cards = [
  { id: "1", question: "水", answer: "みず", tag: "N5" },
  { id: "2", question: "火", answer: "ひ", tag: "N5" },
];

describe("QuickDrillMode", () => {
  it("flips with space, rates with arrows, and shows a summary", async () => {
    const user = userEvent.setup();
    render(<QuickDrillMode cards={cards} />);

    await user.keyboard(" ");
    expect(screen.getByText("みず")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    await screen.findByText("火");

    await user.keyboard(" ");
    expect(await screen.findByText("ひ")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");

    expect(await screen.findByText("Drill complete")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });
});
