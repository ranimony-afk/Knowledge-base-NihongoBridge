import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DictionaryManager } from "@/components/dictionary/DictionaryManager";
import { Providers } from "@/components/ui/Providers";

function renderManager() {
  return render(
    <Providers>
      <DictionaryManager />
    </Providers>,
  );
}

describe("DictionaryManager", () => {
  it("filters entries and opens the full JSONB edit form", async () => {
    const user = userEvent.setup();
    renderManager();
    const search = screen.getByPlaceholderText("Search word, reading, romaji, meaning…");
    await user.type(search, "穏やか");
    expect(screen.getByText("calm; gentle")).toBeInTheDocument();
    expect(screen.queryByText("to drink")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit 穏やか" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Meanings JSONB")).toBeInTheDocument();
  });
});
