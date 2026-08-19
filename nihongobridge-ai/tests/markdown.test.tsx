// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownMessage } from "@/components/ai/MarkdownMessage";

describe("tutor markdown rendering", () => {
  it("renders furigana ruby while removing unsafe script content", () => {
    const { container } = render(
      <MarkdownMessage content={'**Word:** <ruby>水<rt>みず</rt></ruby><script>alert("x")</script>'} />,
    );
    expect(screen.getByText("水")).toBeInTheDocument();
    expect(container.querySelector("ruby rt")?.textContent).toBe("みず");
    expect(container.querySelector("script")).toBeNull();
  });
});
