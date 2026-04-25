// @vitest-environment jsdom
import type { ProviderSnapshot } from "@pi-desktop/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as React from "react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  cn: (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(" "),
  Button({ children, className, ...props }: React.ComponentProps<"button">) {
    return (
      <button className={className} {...props}>
        {children}
      </button>
    );
  },
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

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // noop
  }
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

  it("shows favorited models at top with Favorites header", async () => {
    const user = userEvent.setup();

    renderPromptDock({
      favoriteModels: ["anthropic::claude-sonnet-4-20250514"],
    });

    await user.click(screen.getByTestId("model-selector-trigger"));

    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
  });

  it("calls onToggleFavorite when star is clicked", async () => {
    const user = userEvent.setup();
    const onToggleFavorite = vi.fn();

    renderPromptDock({
      favoriteModels: ["anthropic::claude-sonnet-4-20250514"],
      onToggleFavorite,
    });

    await user.click(screen.getByTestId("model-selector-trigger"));
    await user.click(
      screen.getByTestId("toggle-favorite-anthropic-claude-sonnet-4-20250514"),
    );

    expect(onToggleFavorite).toHaveBeenCalledWith(
      "anthropic::claude-sonnet-4-20250514",
    );
  });

  it("does not show Favorites header when no models are favorited", async () => {
    const user = userEvent.setup();

    renderPromptDock({ favoriteModels: [] });

    await user.click(screen.getByTestId("model-selector-trigger"));

    expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
  });

  it("renders the prompt context counter using tokens and context window", () => {
    renderPromptDock({
      currentModelValue: "anthropic::claude-sonnet-4-20250514",
      contextUsage: {
        tokens: 52_428,
        contextWindow: 200_000,
        percent: null,
      },
    });

    const counter = screen.getByTestId("prompt-context-counter");
    expect(counter).toHaveTextContent("52.4K / 200K");
    expect(screen.queryByTestId("prompt-char-counter")).not.toBeInTheDocument();
  });

  it("keeps showing the total context window when used tokens are unknown", () => {
    renderPromptDock({
      currentModelValue: "anthropic::claude-sonnet-4-20250514",
      contextUsage: {
        tokens: null,
        contextWindow: 200_000,
        percent: null,
      },
    });

    expect(screen.getByTestId("prompt-context-counter")).toHaveTextContent(
      "— / 200K",
    );
    expect(
      screen.queryByRole("img", { name: /Context window usage/i }),
    ).not.toBeInTheDocument();
  });

  it("merges built-in slash commands into the autocomplete when draft begins with /", () => {
    renderPromptDock({ draft: "/" });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    // Built-ins visible
    expect(screen.getByRole("option", { name: /help/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /clear/i })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /settings/i }),
    ).toBeInTheDocument();
  });

  it("dispatches pi:command and clears the draft when a built-in is selected", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    const onAutocompleteSelect = vi.fn();
    const piCommandEvents: string[] = [];
    const listener = (event: Event) => {
      const custom = event instanceof CustomEvent ? event : null;
      const detail = custom?.detail;
      if (detail && typeof detail === "object" && "commandId" in detail) {
        const id = (detail as { commandId: unknown }).commandId;
        if (typeof id === "string") piCommandEvents.push(id);
      }
    };
    window.addEventListener("pi:command", listener);

    renderPromptDock({
      draft: "/help",
      onDraftChange,
      onAutocompleteSelect,
    });

    await user.click(screen.getByRole("option", { name: /help/i }));

    expect(piCommandEvents).toContain("help");
    expect(onDraftChange).toHaveBeenCalledWith("");
    // Built-ins bypass the parent suggestion handler
    expect(onAutocompleteSelect).not.toHaveBeenCalled();

    window.removeEventListener("pi:command", listener);
  });

  it("submits on Cmd+Enter", () => {
    const onSend = vi.fn();

    renderPromptDock({ draft: "ready", onSend });

    fireEvent.keyDown(screen.getByTestId("chat-input"), {
      key: "Enter",
      metaKey: true,
    });

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("persists the draft per thread in localStorage", () => {
    renderPromptDock({
      draft: "work in progress",
      activeThreadId: "thread-42",
    });

    expect(window.localStorage.getItem("pi:prompt-draft:thread-42")).toBe(
      "work in progress",
    );
  });

  it("cycles prompt history with ArrowUp / ArrowDown", () => {
    window.localStorage.setItem(
      "pi:prompt-history:thread-1",
      JSON.stringify(["first", "second"]),
    );
    const onDraftChange = vi.fn();

    renderPromptDock({ draft: "", onDraftChange });

    const input = screen.getByTestId("chat-input");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onDraftChange).toHaveBeenLastCalledWith("second");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onDraftChange).toHaveBeenLastCalledWith("first");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onDraftChange).toHaveBeenLastCalledWith("second");
  });
});
