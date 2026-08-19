import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DictionarySearch } from "@/components/dictionary/DictionarySearch";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => replace.mockClear());

describe("DictionarySearch", () => {
  it("waits for IME composition and supports autocomplete keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<DictionarySearch demo />);
    const input = screen.getByPlaceholderText("日本語・かな・romaji・English");

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "水" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.compositionEnd(input, { data: "水" });

    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(input).toHaveValue("水");
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });
});
