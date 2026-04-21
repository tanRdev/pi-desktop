// @vitest-environment jsdom
import type {
  MentionSuggestion,
  ProviderSnapshot,
  SlashSuggestion,
} from "@pi-desktop/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePromptDockDisplay } from "./use-prompt-dock-display";

interface PromptDockContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

interface UsePromptDockDisplayOptions {
  draft: string;
  activeThreadId: string | null;
  autocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  onDraftChange: (draft: string) => void;
  onAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  contextUsage?: PromptDockContextUsage | null;
}

interface PromptDockDisplayController {
  mergedSuggestions: (SlashSuggestion | MentionSuggestion)[];
  autocompleteVisible: boolean;
  handleAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  currentModelDisplay: string;
  currentContextWindow: number | null;
  currentContextTokens: number | null;
  currentContextPercentage: number | null;
}

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

function createOptions(
  overrides: Partial<UsePromptDockDisplayOptions> = {},
): UsePromptDockDisplayOptions {
  return {
    draft: "",
    activeThreadId: "thread-1",
    autocompleteSuggestions: [],
    onDraftChange: vi.fn(),
    onAutocompleteSelect: vi.fn(),
    providerSnapshots,
    currentModelValue: "google::gemini-2.5-pro",
    contextUsage: {
      tokens: 52_428,
      contextWindow: 200_000,
      percent: null,
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePromptDockDisplay", () => {
  it("merges built-in slash suggestions and dedupes by slash", () => {
    const existingSuggestion: SlashSuggestion = {
      kind: "command",
      name: "help",
      slash: "/help",
      description: "Existing help command",
    };

    const { result } = renderHook<
      PromptDockDisplayController,
      UsePromptDockDisplayOptions
    >((props) => usePromptDockDisplay(props), {
      initialProps: createOptions({
        draft: "/h",
        autocompleteSuggestions: [existingSuggestion],
      }),
    });

    expect(result.current.autocompleteVisible).toBe(true);
    expect(result.current.mergedSuggestions).toEqual(
      expect.arrayContaining([
        existingSuggestion,
        expect.objectContaining({ slash: "/help" }),
      ]),
    );

    const helpSuggestions = result.current.mergedSuggestions.filter(
      (suggestion: SlashSuggestion | MentionSuggestion) =>
        !("id" in suggestion) && suggestion.slash === "/help",
    );
    expect(helpSuggestions).toHaveLength(1);
  });

  it("dispatches built-in slash commands and clears the draft", () => {
    const onDraftChange = vi.fn();
    const onAutocompleteSelect = vi.fn();
    const commands: string[] = [];
    const listener = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (!detail || typeof detail !== "object") return;
      if (!("commandId" in detail)) return;
      if (typeof detail.commandId === "string") commands.push(detail.commandId);
    };

    window.addEventListener("pi:command", listener);

    const { result } = renderHook<
      PromptDockDisplayController,
      UsePromptDockDisplayOptions
    >((props) => usePromptDockDisplay(props), {
      initialProps: createOptions({
        draft: "/help",
        onDraftChange,
        onAutocompleteSelect,
      }),
    });

    act(() => {
      result.current.handleAutocompleteSelect({
        kind: "command",
        name: "help",
        slash: "/help",
        description: "Show help",
      });
    });

    expect(commands).toContain("help");
    expect(onDraftChange).toHaveBeenCalledWith("");
    expect(onAutocompleteSelect).not.toHaveBeenCalled();

    window.removeEventListener("pi:command", listener);
  });

  it("forwards non-built-in suggestions to the parent handler", () => {
    const suggestion: MentionSuggestion = {
      id: "file:/tmp/app.ts",
      kind: "file",
      name: "app.ts",
      context: "/tmp/app.ts",
    };
    const onAutocompleteSelect = vi.fn();

    const { result } = renderHook<
      PromptDockDisplayController,
      UsePromptDockDisplayOptions
    >((props) => usePromptDockDisplay(props), {
      initialProps: createOptions({
        onAutocompleteSelect,
      }),
    });

    act(() => {
      result.current.handleAutocompleteSelect(suggestion);
    });

    expect(onAutocompleteSelect).toHaveBeenCalledWith(suggestion);
  });

  it("applies pi-chat-suggestion events only when a thread is active", () => {
    const activeDraftChange = vi.fn();
    const inactiveDraftChange = vi.fn();

    renderHook<PromptDockDisplayController, UsePromptDockDisplayOptions>(
      (props) => usePromptDockDisplay(props),
      {
        initialProps: createOptions({
          activeThreadId: "thread-1",
          onDraftChange: activeDraftChange,
        }),
      },
    );

    renderHook<PromptDockDisplayController, UsePromptDockDisplayOptions>(
      (props) => usePromptDockDisplay(props),
      {
        initialProps: createOptions({
          activeThreadId: null,
          onDraftChange: inactiveDraftChange,
        }),
      },
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pi-chat-suggestion", { detail: "Summarize the diff" }),
      );
    });

    expect(activeDraftChange).toHaveBeenCalledWith("Summarize the diff");
    expect(inactiveDraftChange).not.toHaveBeenCalled();
  });

  it("derives model and context display values", () => {
    const { result } = renderHook<
      PromptDockDisplayController,
      UsePromptDockDisplayOptions
    >((props) => usePromptDockDisplay(props), {
      initialProps: createOptions({
        currentModelValue: "anthropic::claude-sonnet-4-20250514",
        contextUsage: {
          tokens: 52_428,
          contextWindow: 200_000,
          percent: null,
        },
      }),
    });

    expect(result.current.currentModelDisplay).toBe("Claude Sonnet 4");
    expect(result.current.currentContextTokens).toBe(52_428);
    expect(result.current.currentContextWindow).toBe(200_000);
    expect(result.current.currentContextPercentage).toBe(26);
  });

  it("falls back to the selected model context window when tokens are unavailable", () => {
    const { result } = renderHook<
      PromptDockDisplayController,
      UsePromptDockDisplayOptions
    >((props) => usePromptDockDisplay(props), {
      initialProps: createOptions({
        currentModelValue: "google::gemini-2.5-pro",
        contextUsage: null,
      }),
    });

    expect(result.current.currentContextTokens).toBeNull();
    expect(result.current.currentContextWindow).toBe(1_048_576);
    expect(result.current.currentContextPercentage).toBeNull();
  });
});
