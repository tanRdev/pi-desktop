import { describe, expect, it, vi } from "vitest";
import { createUiInteractionStore } from "./ui-interaction-store";
import { createWorkspaceSessionStore } from "./workspace-session-store";
import { syncActiveWorktreeSession } from "./workspace-session-sync";

function makeSessionStore() {
  return createWorkspaceSessionStore({
    getWorkspaceSession: vi.fn(async () => null),
    saveWorkspaceSession: vi.fn(async (s) => s),
    persistDelayMs: 0,
  });
}

describe("syncActiveWorktreeSession", () => {
  it("is a no-op when the worktree id is unchanged", async () => {
    const sessionStore = makeSessionStore();
    const uiStore = createUiInteractionStore();
    const spy = vi.spyOn(sessionStore.getState(), "setActiveWorktree");

    await syncActiveWorktreeSession({
      nextWorktreeId: "wt-1",
      previousWorktreeId: "wt-1",
      sessionStore,
      uiStore,
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it("sets the active worktree and clears workspace-scoped ui state", async () => {
    const sessionStore = makeSessionStore();
    const uiStore = createUiInteractionStore();
    uiStore.getState().setDraggingWindowId("drag");
    uiStore.getState().openLauncherOverlay();

    await syncActiveWorktreeSession({
      nextWorktreeId: "wt-1",
      previousWorktreeId: null,
      sessionStore,
      uiStore,
    });

    expect(sessionStore.getState().activeWorktreeId).toBe("wt-1");
    expect(uiStore.getState().draggingWindowId).toBeNull();
    expect(uiStore.getState().overlays.launcher.isOpen).toBe(false);
  });

  it("round-trips previous -> next -> previous activations", async () => {
    const sessionStore = makeSessionStore();
    const uiStore = createUiInteractionStore();

    await syncActiveWorktreeSession({
      nextWorktreeId: "wt-a",
      previousWorktreeId: null,
      sessionStore,
      uiStore,
    });
    expect(sessionStore.getState().activeWorktreeId).toBe("wt-a");

    await syncActiveWorktreeSession({
      nextWorktreeId: "wt-b",
      previousWorktreeId: "wt-a",
      sessionStore,
      uiStore,
    });
    expect(sessionStore.getState().activeWorktreeId).toBe("wt-b");

    await syncActiveWorktreeSession({
      nextWorktreeId: "wt-a",
      previousWorktreeId: "wt-b",
      sessionStore,
      uiStore,
    });
    expect(sessionStore.getState().activeWorktreeId).toBe("wt-a");
  });
});
