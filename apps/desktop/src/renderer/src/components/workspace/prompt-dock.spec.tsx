import type { ProviderSnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as React from "react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptDock } from "./prompt-dock";

type PromptInputProps = React.PropsWithChildren<{
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  className?: string;
}>;

type PromptInputSectionProps = React.PropsWithChildren<{
  className?: string;
}>;

type PromptTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

vi.mock("@pi-desktop/ui", () => ({
  PromptInput({ children, className }: PromptInputProps) {
    return <div className={className}>{children}</div>;
  },
  PromptInputAction({ children }: PromptInputSectionProps) {
    return <div>{children}</div>;
  },
  PromptInputActions({ children, className }: PromptInputSectionProps) {
    return <div className={className}>{children}</div>;
  },
  PromptInputTextarea(props: PromptTextareaProps) {
    return <textarea {...props} />;
  },
}));

const providerSnapshots: ProviderSnapshot[] = [
  {
    id: "google",
    name: "Google",
    isConfigured: true,
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        providerId: "google",
        contextWindow: 1_048_576,
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    isConfigured: true,
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        providerId: "anthropic",
        contextWindow: 200_000,
      },
    ],
  },
];

function renderPromptDock(
  overrides: Partial<ComponentProps<typeof PromptDock>> = {},
) {
  return render(
    <PromptDock
      draft=""
      onDraftChange={vi.fn()}
      onSend={vi.fn()}
      onCancelPrompt={vi.fn()}
      activeThreadId="thread-1"
      canSend
      isVisible
      isPromptExecuting={false}
      autocompleteSuggestions={[]}
      autocompleteSelectedIndex={-1}
      onAutocompleteSelect={vi.fn()}
      onAutocompleteHover={vi.fn()}
      onPromptKeyDown={vi.fn()}
      providerSnapshots={providerSnapshots}
      currentModelValue="google::gemini-2.5-pro"
      contextUsage={{
        tokens: 52_428,
        contextWindow: 200_000,
        percent: null,
      }}
      isSwitchingModel={false}
      onModelSelection={vi.fn()}
      onConnectProvider={vi.fn()}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("PromptDock", () => {
  it("renders the active model label and actual context usage percent", () => {
    renderPromptDock();

    expect(screen.getByTestId("model-selector-trigger")).toHaveTextContent(
      "Gemini 2.5 Pro",
    );
    expect(
      screen.getByRole("img", { name: "Context window usage 26%" }),
    ).toBeInTheDocument();
    expect(screen.getByText("26%")).toBeInTheDocument();
  });

  it("forwards the chosen model through the hidden select bridge", async () => {
    const user = userEvent.setup();
    const selectedValues: string[] = [];

    renderPromptDock({
      onModelSelection: (event) => {
        selectedValues.push(event.target.value);
      },
    });

    await user.click(screen.getByTestId("model-selector-trigger"));
    await user.click(
      screen.getByTestId("model-option-anthropic-claude-sonnet-4-20250514"),
    );

    expect(selectedValues).toEqual(["anthropic::claude-sonnet-4-20250514"]);
  });

  it("disables model switching while a switch is already in flight", () => {
    renderPromptDock({ isSwitchingModel: true });

    expect(screen.getByTestId("model-selector-trigger")).toBeDisabled();
    expect(screen.getByText("Switching")).toBeInTheDocument();
  });

  it("shows slash autocomplete suggestions when the chat input has slash results", () => {
    renderPromptDock({
      draft: "/",
      autocompleteSuggestions: [
        {
          kind: "skill",
          name: "review",
          slash: "/skill:review",
          description: "Review the current changes",
        },
        {
          kind: "command",
          name: "ship",
          slash: "/ship",
          description: "Ship the current app",
        },
      ],
    });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Commands")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /review/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /ship/i })).toBeInTheDocument();
  });

  it("forwards clicked slash autocomplete suggestions", async () => {
    const user = userEvent.setup();
    const suggestion = {
      kind: "skill" as const,
      name: "review",
      slash: "/skill:review",
      description: "Review the current changes",
    };
    const onAutocompleteSelect = vi.fn();

    renderPromptDock({
      draft: "/",
      autocompleteSuggestions: [suggestion],
      onAutocompleteSelect,
    });

    await user.click(screen.getByRole("option", { name: /review/i }));

    expect(onAutocompleteSelect).toHaveBeenCalledWith(suggestion);
  });
});
