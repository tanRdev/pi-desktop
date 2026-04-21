// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUiInteractionStore } from "@/stores/ui-interaction-store";
import {
  createWorkspaceSessionStore,
  type ThreadConversationState,
} from "@/stores/workspace-session-store";
import { useWorkspaceShellSync } from "./use-workspace-shell-sync";

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

function createSessionStore() {
  return createWorkspaceSessionStore({
    getWorkspaceSession: vi.fn(async () => null),
    saveWorkspaceSession: vi.fn(async (session) => session),
    persistDelayMs: 0,
  });
}

function createSelection(
  overrides: Partial<{
    repositoryId: string | null;
    worktreeId: string | null;
    threadId: string | null;
  }> = {},
) {
  return {
    repositoryId: null,
    worktreeId: null,
    threadId: null,
    ...overrides,
  };
}

describe("useWorkspaceShellSync", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks the previous and current thread as viewed when the active thread changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T10:00:00.000Z"));

    const uiStore = createUiInteractionStore();
    const sessionStore = createSessionStore();
    const reload = vi.fn(async () => undefined);

    const { rerender } = renderHook(
      ({ activeThreadId }: { activeThreadId: string | null }) =>
        useWorkspaceShellSync({
          activeThreadId,
          activeWorktreeId: null,
          agent: createConversation(),
          reload,
          repositoryCount: 1,
          selection: createSelection(),
          sessionStore,
          uiStore,
        }),
      {
        initialProps: { activeThreadId: "thread-1" },
      },
    );

    expect(uiStore.getState().threadLastViewedAt).toEqual({
      "thread-1": Date.now(),
    });

    vi.setSystemTime(new Date("2026-04-20T10:05:00.000Z"));

    rerender({ activeThreadId: "thread-2" });

    expect(uiStore.getState().threadLastViewedAt).toEqual({
      "thread-1": Date.now(),
      "thread-2": Date.now(),
    });
  });

  it("persists the active thread conversation for the active worktree", async () => {
    const uiStore = createUiInteractionStore();
    const sessionStore = createSessionStore();

    await act(async () => {
      await sessionStore.getState().setActiveWorktree("worktree-1");
    });

    renderHook(() =>
      useWorkspaceShellSync({
        activeThreadId: "thread-1",
        activeWorktreeId: "worktree-1",
        agent: createConversation({ status: "streaming" }),
        reload: vi.fn(async () => undefined),
        repositoryCount: 1,
        selection: createSelection(),
        sessionStore,
        uiStore,
      }),
    );

    await waitFor(() => {
      expect(
        sessionStore
          .getState()
          .sessionsByWorktreeId["worktree-1"]?.threadConversations.get(
            "thread-1",
          ),
      ).toEqual({
        messages: [],
        status: "streaming",
        lastError: null,
      });
    });
  });

  it("retries reloading when selection remains non-empty without repositories", () => {
    vi.useFakeTimers();

    const reload = vi.fn(async () => undefined);

    renderHook(() =>
      useWorkspaceShellSync({
        activeThreadId: null,
        activeWorktreeId: null,
        agent: createConversation(),
        reload,
        repositoryCount: 0,
        selection: createSelection({ repositoryId: "repo-1" }),
        sessionStore: createSessionStore(),
        uiStore: createUiInteractionStore(),
      }),
    );

    expect(reload).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(249);
    });

    expect(reload).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
