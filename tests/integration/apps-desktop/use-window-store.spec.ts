import { describe, expect, it } from "vitest";
import {
  createWindowStoreSnapshotCache,
  type WindowStoreState,
} from "../../../apps/desktop/src/renderer/src/hooks/use-window-store";
import { createUiInteractionStore } from "../../../apps/desktop/src/renderer/src/stores/ui-interaction-store";
import { createWorkspaceSessionStore } from "../../../apps/desktop/src/renderer/src/stores/workspace-session-store";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

describe("use-window-store snapshot stability", () => {
  it("reuses the previous snapshot when layout and ui references are unchanged", () => {
    const cache = createWindowStoreSnapshotCache();
    const session = createEmptyWorkspaceSession("/tmp/repo-a");

    const firstSnapshot = cache.getSnapshot({
      layout: session.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });
    const secondSnapshot = cache.getSnapshot({
      layout: session.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    expect(secondSnapshot).toBe(firstSnapshot);
  });

  it("returns a new snapshot when any subscribed reference changes", () => {
    const cache = createWindowStoreSnapshotCache();
    const session = createEmptyWorkspaceSession("/tmp/repo-a");

    const firstSnapshot = cache.getSnapshot({
      layout: session.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    const nextSnapshot = cache.getSnapshot({
      layout: {
        ...session.layout,
        windows: [...session.layout.windows],
      },
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    expect(nextSnapshot).not.toBe(firstSnapshot);
  });

  it("reuses the same fallback layout snapshot across unchanged empty states", () => {
    const cache = createWindowStoreSnapshotCache();

    const firstSnapshot = cache.getSnapshot({
      layout: {
        windows: [],
        nextZIndex: 1,
        focusedWindowId: null,
        snapGridSize: 16,
      },
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });
    const secondSnapshot = cache.getSnapshot({
      layout: firstSnapshot.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    expect(secondSnapshot).toBe(firstSnapshot);
  });

  it("does not change layout references when only thread conversation state updates", () => {
    const uiStore = createUiInteractionStore();
    const sessionStore = createWorkspaceSessionStore({
      getWorkspaceSession: async () => null,
      saveWorkspaceSession: async (session) => session,
    });

    void uiStore;

    const worktreeId = "/tmp/repo-a";
    const session = createEmptyWorkspaceSession(worktreeId);
    sessionStore.getState().hydrateCatalogSessions([session]);

    const beforeSession =
      sessionStore.getState().sessionsByWorktreeId[worktreeId];
    if (!beforeSession) {
      throw new Error("Expected hydrated workspace session");
    }

    sessionStore
      .getState()
      .setThreadConversationForWorktree(worktreeId, "thread-1", {
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            text: "Hello",
            status: "complete",
            timestamp: 1,
          },
        ],
        status: "ready",
        lastError: null,
      });

    const afterSession =
      sessionStore.getState().sessionsByWorktreeId[worktreeId];
    if (!afterSession) {
      throw new Error("Expected updated workspace session");
    }

    expect(afterSession.layout).toBe(beforeSession.layout);
    expect(afterSession.threadConversations).not.toBe(
      beforeSession.threadConversations,
    );
  });
});

type _WindowStoreState = WindowStoreState;
void (0 as unknown as _WindowStoreState);
