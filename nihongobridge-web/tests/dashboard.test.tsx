import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { QueryProvider } from "@/components/providers/QueryProvider";

describe("Dashboard", () => {
  it("loads the cached dashboard model and renders core study summaries", async () => {
    render(
      <QueryProvider>
        <Dashboard demo />
      </QueryProvider>,
    );

    expect(await screen.findByText(/Aiko!/)).toBeInTheDocument();
    expect(screen.getByText("24 cards")).toBeInTheDocument();
    expect(screen.getByText("580 XP today")).toBeInTheDocument();
    expect(screen.getByText("Weak areas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start SRS/ })).toHaveAttribute("href", "/srs/demo");
  });
});
