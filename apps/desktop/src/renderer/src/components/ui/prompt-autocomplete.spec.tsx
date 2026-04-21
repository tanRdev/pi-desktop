// @vitest-environment jsdom
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

  it("renders nothing when visible is false", () => {
    const { container } = render(
      <PromptAutocomplete
        visible={false}
        suggestions={[
          {
            kind: "command",
            name: "ship",
            slash: "/ship",
          },
        ]}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("shows the empty-state label when visible with no suggestions", () => {
    render(<PromptAutocomplete visible suggestions={[]} />);

    expect(screen.getByText(/no suggestions/i)).toBeInTheDocument();
  });

  it("marks the selected suggestion with aria-selected", () => {
    render(
      <PromptAutocomplete
        visible
        selectedIndex={0}
        suggestions={[
          {
            kind: "command",
            name: "ship",
            slash: "/ship",
          },
        ]}
      />,
    );

    expect(screen.getByRole("option", { name: /ship/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
