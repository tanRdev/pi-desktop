import type { SlashSuggestion } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptAutocomplete } from "./prompt-autocomplete";

afterEach(() => {
  cleanup();
});

describe("PromptAutocomplete", () => {
  it("renders grouped suggestions and forwards pointer interactions", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onHover = vi.fn();
    const suggestions = [
      {
        kind: "skill",
        name: "review",
        slash: "/skill:review",
        description: "Review code",
      },
      {
        kind: "command",
        name: "ship",
        slash: "/ship",
        description: "Ship app",
      },
    ] satisfies SlashSuggestion[];

    render(
      <PromptAutocomplete
        visible
        suggestions={suggestions}
        onSelect={onSelect}
        onHover={onHover}
      />,
    );

    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Commands")).toBeInTheDocument();

    await user.hover(screen.getByRole("option", { name: /ship/i }));
    await user.click(screen.getByRole("option", { name: /review/i }));

    expect(onHover).toHaveBeenCalledWith(1);
    expect(onSelect).toHaveBeenCalledWith(suggestions[0]);
  });

  it("expands collapsed sections when more than five items are present", async () => {
    const user = userEvent.setup();
    const suggestions = Array.from({ length: 6 }, (_, index) => ({
      kind: "command" as const,
      name: `command-${index + 1}`,
      slash: `/command-${index + 1}`,
    }));

    render(<PromptAutocomplete visible suggestions={suggestions} />);

    expect(screen.queryByText("command-6")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show 1 more/i }));

    expect(screen.getByText("command-6")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show less/i }),
    ).toBeInTheDocument();
  });
});
