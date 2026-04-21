// @vitest-environment jsdom
import type { MentionSuggestion, SlashSuggestion } from "@pi-desktop/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUiInteractionStore } from "@/stores/ui-interaction-store";
import type { ThreadConversationState } from "@/stores/workspace-session-store";
import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../../test/mock-pi-desktop";
import { useWorkspacePrompt } from "./use-workspace-prompt";

function requireNamespace(
  namespace: Record<string, ReturnType<typeof vi.fn>> | undefined,
  label: string,
) {
  if (!namespace) {
    throw new Error(`Missing mock namespace: ${label}`);
  }

  return namespace;
}

function createConversation(
  overrides: Partial<ThreadConversationState> = {},
): ThreadConversationState {
  return {
    messages: [],
    status: "idle",
    lastError: null,
    ...overrides,
  };
}

const contextWindows = [
  {
    id: "terminal-1",
    kind: "terminal" as const,
    title: "Main Terminal",
    terminalId: "terminal-1",
    backend: "shell" as const,
    cwd: "/tmp/repo",
    isFocused: true,
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    zIndex: 1,
    state: "normal" as const,
  },
];

describe("useWorkspacePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    uninstallMockPiDesktop();
  });

  it("loads slash autocomplete suggestions and replaces the selected token", async () => {
    const setDraft = vi.fn();
    const sendPrompt = vi.fn(async () => undefined);
    const cancelPrompt = vi.fn(async () => undefined);
    const openOAuthDialog = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const suggestion: SlashSuggestion = {
      kind: "skill",
      name: "review",
      slash: "/skill:review",
      description: "Review the current changes",
    };
    const api = installMockPiDesktop({
      agent: {
        getSlashSuggestions: vi.fn(async () => ({ suggestions: [suggestion] })),
      },
      search: {
        searchFiles: vi.fn(async () => ({ results: [] })),
      },
    });
    const agent = requireNamespace(api.agent, "agent");

    const { result } = renderHook(() =>
      useWorkspacePrompt({
        draft: "/re",
        setDraft,
        sendPrompt,
        cancelPrompt,
        activeThreadId: "thread-1",
        activeThreadConversation: createConversation(),
        agentStatus: "idle",
        activeWorktreePath: "/tmp/repo",
        contextWindows: [],
        uiStore,
        openOAuthDialog,
      }),
    );

    await waitFor(() => {
      expect(result.current.autocompleteSuggestions).toEqual([suggestion]);
    });

    act(() => {
      result.current.handleAutocompleteSelect(suggestion);
    });

    expect(agent.getSlashSuggestions).toHaveBeenCalledWith({
      text: "/re",
      cursorPosition: 3,
      trigger: "/",
      query: "re",
    });
    expect(setDraft).toHaveBeenCalledWith("/skill:review ");
    expect(result.current.autocompleteSuggestions).toEqual([]);
    expect(result.current.autocompleteSelectedIndex).toBe(-1);
  });

  it("routes oauth slash commands through the dialog flow instead of sending", async () => {
    const setDraft = vi.fn();
    const sendPrompt = vi.fn(async () => undefined);
    const cancelPrompt = vi.fn(async () => undefined);
    const openOAuthDialog = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();

    installMockPiDesktop({
      agent: {
        getSlashSuggestions: vi.fn(async () => ({ suggestions: [] })),
      },
      search: {
        searchFiles: vi.fn(async () => ({ results: [] })),
      },
    });

    const { result } = renderHook(() =>
      useWorkspacePrompt({
        draft: "/logout github",
        setDraft,
        sendPrompt,
        cancelPrompt,
        activeThreadId: "thread-1",
        activeThreadConversation: createConversation(),
        agentStatus: "idle",
        activeWorktreePath: "/tmp/repo",
        contextWindows: [],
        uiStore,
        openOAuthDialog,
      }),
    );

    await act(async () => {
      await result.current.handleSend();
    });

    expect(setDraft).toHaveBeenCalledWith("");
    expect(openOAuthDialog).toHaveBeenCalledWith("logout", "github-copilot");
    expect(sendPrompt).not.toHaveBeenCalled();
  });

  it("updates prompt mode and rewrites the draft with the matching prefix", () => {
    const setDraft = vi.fn();
    const sendPrompt = vi.fn(async () => undefined);
    const cancelPrompt = vi.fn(async () => undefined);
    const openOAuthDialog = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();

    installMockPiDesktop({
      agent: {
        getSlashSuggestions: vi.fn(async () => ({ suggestions: [] })),
      },
      search: {
        searchFiles: vi.fn(async () => ({ results: [] })),
      },
    });

    const { result } = renderHook(() =>
      useWorkspacePrompt({
        draft: "ship it",
        setDraft,
        sendPrompt,
        cancelPrompt,
        activeThreadId: "thread-1",
        activeThreadConversation: createConversation(),
        agentStatus: "idle",
        activeWorktreePath: "/tmp/repo",
        contextWindows: [],
        uiStore,
        openOAuthDialog,
      }),
    );

    act(() => {
      result.current.handlePromptModeChange("plan");
    });

    expect(result.current.promptMode).toBe("plan");
    expect(setDraft).toHaveBeenCalledWith("/skill:plan ship it");
  });

  it("queues the agent git shortcut into the active thread when idle", async () => {
    const setDraft = vi.fn();
    const sendPrompt = vi.fn(async () => undefined);
    const cancelPrompt = vi.fn(async () => undefined);
    const openOAuthDialog = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();

    installMockPiDesktop({
      agent: {
        getSlashSuggestions: vi.fn(async () => ({ suggestions: [] })),
      },
      search: {
        searchFiles: vi.fn(async () => ({ results: [] })),
      },
    });

    const { result } = renderHook(() =>
      useWorkspacePrompt({
        draft: "",
        setDraft,
        sendPrompt,
        cancelPrompt,
        activeThreadId: "thread-1",
        activeThreadConversation: createConversation(),
        agentStatus: "idle",
        activeWorktreePath: "/tmp/repo",
        contextWindows: [],
        uiStore,
        openOAuthDialog,
      }),
    );

    await act(async () => {
      await result.current.handleAgentGitAction("Summarize the git diff");
    });

    expect(setDraft).toHaveBeenCalledWith("Summarize the git diff");
    expect(sendPrompt).toHaveBeenCalledTimes(1);
  });

  it("builds mention autocomplete suggestions from open windows and file search", async () => {
    const setDraft = vi.fn();
    const sendPrompt = vi.fn(async () => undefined);
    const cancelPrompt = vi.fn(async () => undefined);
    const openOAuthDialog = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const fileSuggestion: MentionSuggestion = {
      kind: "file",
      id: "src/app.tsx",
      name: "app.tsx",
      context: "src/app.tsx",
    };
    const api = installMockPiDesktop({
      agent: {
        getSlashSuggestions: vi.fn(async () => ({ suggestions: [] })),
      },
      search: {
        searchFiles: vi.fn(async () => ({
          results: [{ type: "file", path: "src/app.tsx", name: "app.tsx" }],
        })),
      },
    });
    const search = requireNamespace(api.search, "search");

    const { result } = renderHook(() =>
      useWorkspacePrompt({
        draft: "@app",
        setDraft,
        sendPrompt,
        cancelPrompt,
        activeThreadId: "thread-1",
        activeThreadConversation: createConversation(),
        agentStatus: "idle",
        activeWorktreePath: "/tmp/repo",
        contextWindows,
        uiStore,
        openOAuthDialog,
      }),
    );

    await waitFor(() => {
      expect(result.current.autocompleteSuggestions).toContainEqual(
        fileSuggestion,
      );
    });

    expect(search.searchFiles).toHaveBeenCalledWith({
      query: "app",
      rootPath: "/tmp/repo",
      maxResults: 8,
    });
  });
});
