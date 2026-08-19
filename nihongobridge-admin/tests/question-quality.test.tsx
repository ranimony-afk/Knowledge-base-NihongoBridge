import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuestionBank } from "@/components/questions/QuestionBank";
import { Providers } from "@/components/ui/Providers";

describe("QuestionBank", () => {
  it("shows low-confidence human-review flags", () => {
    render(
      <Providers>
        <QuestionBank />
      </Providers>,
    );
    expect(screen.getAllByText("48%").length).toBeGreaterThan(0);
    expect(screen.getByText(/low-confidence/)).toBeInTheDocument();
  });
});
