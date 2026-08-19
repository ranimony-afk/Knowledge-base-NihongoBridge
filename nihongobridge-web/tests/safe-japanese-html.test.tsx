import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SafeJapaneseHtml } from "@/components/test/SafeJapaneseHtml";

describe("SafeJapaneseHtml", () => {
  it("preserves ruby markup while removing scripts and event handlers", async () => {
    const { container } = render(
      <SafeJapaneseHtml html={'<ruby>水<rt>みず</rt></ruby><img src=x onerror="alert(1)"><script>alert(1)</script>'} />,
    );

    await waitFor(() => expect(container.querySelector("ruby")).toBeInTheDocument());
    expect(screen.getByText("水")).toBeInTheDocument();
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
