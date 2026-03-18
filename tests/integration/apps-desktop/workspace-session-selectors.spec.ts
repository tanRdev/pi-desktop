import { describe, expect, it, vi } from "vitest";
import {
  selectActiveWorkspaceLayout,
  selectActiveWorkspaceSnapGridSize,
  selectFileWindowStateByWorktree,
  selectSearchUiStateByWorktree,
} from "../../../apps/desktop/src/renderer/src/stores/workspace-session-selectors";
import { createWorkspaceSessionStore } from "../../../apps/desktop/src/renderer/src/stores/workspace-session-store";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

describe("workspace-session-selectors", () => {
  it("reads layout and runtime state from the active worktree session", async () => {
    const sessionA = createEmptyWorkspaceSession("/tmp/repo-a");
    sessionA.layout.snapGridSize = 24;

    const sessionB = createEmptyWorkspaceSession("/tmp/repo-b");
    sessionB.layout.snapGridSize = 40;

    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
    });

    store.getState().hydrateCatalogSessions([sessionA, sessionB]);
    await store.getState().setActiveWorktree("/tmp/repo-a");
    store.getState().setFileContentForWorktree("/tmp/repo-a", "file-window-a", {
      content: null,
      isLoading: true,
      error: null,
    });
    store
      .getState()
      .setSearchUiStateForWorktree("/tmp/repo-b", "search-window-b", {
        isLoading: false,
        selectedIndex: 1,
      });

    expect(selectActiveWorkspaceLayout(store.getState()).snapGridSize).toBe(24);
    expect(selectActiveWorkspaceSnapGridSize(store.getState())).toBe(24);
    expect(
      selectFileWindowStateByWorktree(
        store.getState(),
        "/tmp/repo-a",
        "file-window-a",
      ),
    ).toEqual({
      content: null,
      isLoading: true,
      error: null,
    });

    await store.getState().setActiveWorktree("/tmp/repo-b");

    expect(selectActiveWorkspaceLayout(store.getState()).snapGridSize).toBe(40);
    expect(selectActiveWorkspaceSnapGridSize(store.getState())).toBe(40);
    expect(
      selectSearchUiStateByWorktree(
        store.getState(),
        "/tmp/repo-b",
        "search-window-b",
      ),
    ).toEqual({
      isLoading: false,
      selectedIndex: 1,
    });
  });

  it("reuses a stable empty layout when no active worktree session exists", () => {
    const emptyState = {
      activeWorktreeId: null,
      sessionsByWorktreeId: {},
    } as ReturnType<
      typeof createWorkspaceSessionStore
    >["getState"] extends () => infer T
      ? T
      : never;

    const firstLayout = selectActiveWorkspaceLayout(emptyState);
    const secondLayout = selectActiveWorkspaceLayout(emptyState);

    expect(secondLayout).toBe(firstLayout);
  });
});
