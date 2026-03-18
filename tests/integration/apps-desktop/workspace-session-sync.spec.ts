import { describe, expect, it, vi } from "vitest";
import { createUiInteractionStore } from "../../../apps/desktop/src/renderer/src/stores/ui-interaction-store";
import { createWorkspaceSessionStore } from "../../../apps/desktop/src/renderer/src/stores/workspace-session-store";
import { syncActiveWorktreeSession } from "../../../apps/desktop/src/renderer/src/stores/workspace-session-sync";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

describe("workspace-session-sync", () => {
  it("hydrates the next worktree session and clears transient ui state on switch", async () => {
    const getWorkspaceSession = vi.fn(async (worktreeId: string) =>
      createEmptyWorkspaceSession(worktreeId),
    );
    const sessionStore = createWorkspaceSessionStore({
      getWorkspaceSession,
      saveWorkspaceSession: vi.fn(async (session) => session),
    });
    const uiStore = createUiInteractionStore();

    await sessionStore.getState().setActiveWorktree("/tmp/repo-a");
    uiStore.getState().setDraggingWindowId("chat-window-a");
    uiStore.getState().setPromptAutocomplete([
      {
        kind: "command",
        name: "deploy",
        slash: "/deploy",
        description: "Deploy",
      },
    ]);
    uiStore.getState().setDialogOpen("settings", true);

    await syncActiveWorktreeSession({
      nextWorktreeId: "/tmp/repo-b",
      previousWorktreeId: "/tmp/repo-a",
      sessionStore,
      uiStore,
    });

    expect(getWorkspaceSession).toHaveBeenCalledWith("/tmp/repo-b");
    expect(sessionStore.getState().activeWorktreeId).toBe("/tmp/repo-b");
    expect(uiStore.getState().draggingWindowId).toBeNull();
    expect(uiStore.getState().promptAutocompleteSuggestions).toEqual([]);
    expect(uiStore.getState().dialogs.settings).toBe(true);
  });
});
