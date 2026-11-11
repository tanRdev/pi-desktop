// @vitest-environment jsdom
import type { MentionSuggestion, SlashSuggestion } from "@pi-desktop/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
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
    localStorage.clear();
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

    expect(setDraft).not.toHaveBeenCalled();
    expect(sendPrompt).toHaveBeenCalledWith("Summarize the git diff");
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

describe("follow-up queue (issue #10)", () => {
  function renderPrompt(
    overrides: Partial<Parameters<typeof useWorkspacePrompt>[0]> = {},
  ) {
    const uiStore = createUiInteractionStore();
    installMockPiDesktop({
      agent: {
        getSlashSuggestions: vi.fn(async () => ({ suggestions: [] })),
      },
      search: {
        searchFiles: vi.fn(async () => ({ results: [] })),
      },
    });
    return renderHook(() =>
      useWorkspacePrompt({
        draft: "queued thought",
        setDraft: vi.fn(),
        sendPrompt: vi.fn(async () => undefined),
        cancelPrompt: vi.fn(async () => undefined),
        activeThreadId: "thread-1",
        activeThreadConversation: createConversation({
          status: "streaming",
        }),
        agentStatus: "streaming",
        activeWorktreePath: "/tmp/repo",
        contextWindows: [],
        uiStore,
        openOAuthDialog: vi.fn(async () => undefined),
        enqueueFollowUp: vi.fn(() => "fu-1"),
        steerPrompt: vi.fn(async () => undefined),
        supportsSteer: true,
        editFollowUp: vi.fn(),
        deleteFollowUp: vi.fn(),
        moveFollowUp: vi.fn(),
        setFollowUpPaused: vi.fn(),
        retryFollowUp: vi.fn(),
        followUpQueue: {
          threadId: "thread-1",
          paused: false,
          items: [
            {
              id: "fu-0",
              threadId: "thread-1",
              text: "earlier",
              images: [],
              status: "queued",
              createdAt: 1,
              updatedAt: 1,
              attempts: 0,
              lastError: null,
            },
          ],
        },
        ...overrides,
      }),
    );
  }

  it("queues the draft as a follow-up while a run is active instead of sending or cancelling", async () => {
    const enqueueFollowUp = vi.fn(() => "fu-1");
    const sendPrompt = vi.fn(async () => undefined);
    const setDraft = vi.fn();

    const { result } = renderPrompt({
      enqueueFollowUp,
      sendPrompt,
      setDraft,
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(enqueueFollowUp).toHaveBeenCalledWith("queued thought");
    expect(sendPrompt).not.toHaveBeenCalled();
    expect(setDraft).toHaveBeenCalledWith("");
    expect(result.current.canSend).toBe(true);
    expect(result.current.isPromptExecuting).toBe(true);
  });

  it("steers the current draft when the runtime supports it", async () => {
    const steerPrompt = vi.fn(async () => undefined);
    const setDraft = vi.fn();
    const { result } = renderPrompt({ steerPrompt, setDraft });

    await act(async () => {
      await result.current.handleSteer();
    });

    expect(steerPrompt).toHaveBeenCalledWith("queued thought");
    expect(setDraft).toHaveBeenCalledWith("");
  });

  it("does not steer when the runtime does not support it", async () => {
    const steerPrompt = vi.fn(async () => undefined);
    const { result } = renderPrompt({ steerPrompt, supportsSteer: false });

    await act(async () => {
      await result.current.handleSteer();
    });

    expect(steerPrompt).not.toHaveBeenCalled();
  });

  it("binds queue operations to the active thread", () => {
    const editFollowUp = vi.fn();
    const deleteFollowUp = vi.fn();
    const moveFollowUp = vi.fn();
    const setFollowUpPaused = vi.fn();
    const retryFollowUp = vi.fn();
    const { result } = renderPrompt({
      editFollowUp,
      deleteFollowUp,
      moveFollowUp,
      setFollowUpPaused,
      retryFollowUp,
    });

    act(() => {
      result.current.handleEditFollowUp("fu-0", "edited");
      result.current.handleDeleteFollowUp("fu-0");
      result.current.handleMoveFollowUp("fu-0", -1);
      result.current.handleToggleFollowUpPaused();
      result.current.handleRetryFollowUp("fu-0");
    });

    expect(editFollowUp).toHaveBeenCalledWith("thread-1", "fu-0", "edited");
    expect(deleteFollowUp).toHaveBeenCalledWith("thread-1", "fu-0");
    expect(moveFollowUp).toHaveBeenCalledWith("thread-1", "fu-0", -1);
    expect(setFollowUpPaused).toHaveBeenCalledWith("thread-1", true);
    expect(retryFollowUp).toHaveBeenCalledWith("thread-1", "fu-0");
  });

  it("steers a queued item by removing it from the queue and steering its text", async () => {
    const steerPrompt = vi.fn(async () => undefined);
    const deleteFollowUp = vi.fn();
    const { result } = renderPrompt({ steerPrompt, deleteFollowUp });

    await act(async () => {
      await result.current.handleSteerFollowUp("fu-0");
    });

    expect(deleteFollowUp).toHaveBeenCalledWith("thread-1", "fu-0");
    expect(steerPrompt).toHaveBeenCalledWith("earlier");
  });
});

describe("workspace-owned draft persistence", () => {
  it("persists completion when the prompt UI is not mounted and sends indented text unchanged", async () => {
    installMockPiDesktop();
    const sent = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const { result } = renderHook(() => {
      const [draft, setDraft] = useState("    run()\n\n");
      const controller = useWorkspacePrompt({
        draft,
        setDraft,
        sendPrompt: sent,
        cancelPrompt: async () => {},
        activeThreadId: "hidden-dock",
        activeThreadConversation: createConversation(),
        agentStatus: "idle",
        activeWorktreePath: "/tmp/repo",
        contextWindows: [],
        uiStore,
        openOAuthDialog: async () => {},
      });
      return { controller, setDraft };
    });
    await act(async () => {
      await result.current.controller.handleSend();
    });
    expect(sent).toHaveBeenCalledWith("    run()\n\n");
    act(() => result.current.setDraft(""));
    expect(localStorage.getItem("pi:prompt-draft:hidden-dock")).toBeNull();
    uninstallMockPiDesktop();
  });
});
