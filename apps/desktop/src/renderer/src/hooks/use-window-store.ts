/**
 * React hook for the window store.
 * Provides reactive access to the active worktree's layout state.
 */

import type { WindowLayoutState, WorkspaceWindow } from "@pidesk/shared";
import { getActiveWorktree } from "@pidesk/shared";
import { useSyncExternalStore } from "react";
import {
  type AppShellStoreState,
  getAppShellStore,
} from "../stores/app-shell-store";
import { uiInteractionStore } from "../stores/ui-interaction-store";
import { selectActiveWorkspaceLayout } from "../stores/workspace-session-selectors";
import {
  createWorkspaceSessionStore,
  type WorkspaceSessionStore,
  type WorkspaceSessionStoreState,
} from "../stores/workspace-session-store";
import { syncActiveWorktreeSession } from "../stores/workspace-session-sync";

const FALLBACK_LAYOUT: WindowLayoutState = {
  windows: [],
  nextZIndex: 1,
  focusedWindowId: null,
  snapGridSize: 24,
  zoom: 0.9,
  panX: 0,
  panY: 0,
};

const workspaceSessionStore = createWorkspaceSessionStore({
  getWorkspaceSession: (worktreeId) =>
    window.pidesk.state.getWorkspaceSession(worktreeId),
  saveWorkspaceSession: (session) =>
    window.pidesk.state.saveWorkspaceSession(session),
});

export interface WindowStoreState {
  layout: WindowLayoutState;
  draggingWindowId: string | null;
  resizingWindowId: string | null;
  snapPreview: ReturnType<typeof uiInteractionStore.getState>["snapPreview"];
}

export interface WindowStoreAdapter {
  createWindow: WorkspaceSessionStoreState["createWindow"];
  closeWindow: WorkspaceSessionStoreState["closeWindow"];
  focusWindow: WorkspaceSessionStoreState["focusWindow"];
  moveWindow: WorkspaceSessionStoreState["moveWindow"];
  resizeWindow: WorkspaceSessionStoreState["resizeWindow"];
  updateWindow: WorkspaceSessionStoreState["updateWindow"];
  setDirty: WorkspaceSessionStoreState["setDirty"];
  setZoom: WorkspaceSessionStoreState["setZoom"];
  zoomIn: WorkspaceSessionStoreState["zoomIn"];
  zoomOut: WorkspaceSessionStoreState["zoomOut"];
  resetZoom: WorkspaceSessionStoreState["resetZoom"];
  setPan: WorkspaceSessionStoreState["setPan"];
  setDraggingWindowId(windowId: string | null): void;
  setResizingWindowId(windowId: string | null): void;
  setSnapPreview(preview: WindowStoreState["snapPreview"]): void;
  clearAll: WorkspaceSessionStoreState["clearAll"];
}

export function createWindowStoreSnapshotCache() {
  let cachedSnapshot: WindowStoreState | null = null;

  return {
    getSnapshot(nextSnapshot: WindowStoreState): WindowStoreState {
      if (
        cachedSnapshot &&
        cachedSnapshot.layout === nextSnapshot.layout &&
        cachedSnapshot.draggingWindowId === nextSnapshot.draggingWindowId &&
        cachedSnapshot.resizingWindowId === nextSnapshot.resizingWindowId &&
        cachedSnapshot.snapPreview === nextSnapshot.snapPreview
      ) {
        return cachedSnapshot;
      }

      cachedSnapshot = nextSnapshot;
      return nextSnapshot;
    },
  };
}

const snapshotCache = createWindowStoreSnapshotCache();

function getLayoutState(
  shellState: AppShellStoreState,
  sessionState: WorkspaceSessionStoreState,
): WindowStoreState {
  const activeWorktreeId =
    sessionState.activeWorktreeId ??
    getActiveWorktree(shellState.shellState.shell)?.id ??
    null;
  const layout =
    activeWorktreeId === sessionState.activeWorktreeId
      ? selectActiveWorkspaceLayout(sessionState)
      : activeWorktreeId
        ? (sessionState.sessionsByWorktreeId[activeWorktreeId]?.layout ??
          FALLBACK_LAYOUT)
        : FALLBACK_LAYOUT;

  return snapshotCache.getSnapshot({
    layout,
    draggingWindowId: uiInteractionStore.getState().draggingWindowId,
    resizingWindowId: uiInteractionStore.getState().resizingWindowId,
    snapPreview: uiInteractionStore.getState().snapPreview,
  });
}

function subscribe(listener: () => void): () => void {
  const unsubscribers = [
    getAppShellStore().subscribe(async (shellState, prevShellState) => {
      const nextWorktreeId =
        getActiveWorktree(shellState.shellState.shell)?.id ?? null;
      const prevWorktreeId = prevShellState
        ? (getActiveWorktree(prevShellState.shellState.shell)?.id ?? null)
        : null;

      if (nextWorktreeId !== prevWorktreeId) {
        await syncActiveWorktreeSession({
          nextWorktreeId,
          previousWorktreeId: prevWorktreeId,
          sessionStore: workspaceSessionStore,
          uiStore: uiInteractionStore,
        });
      }

      const nextCatalogSessions =
        shellState.shellState.shell.catalog.reconciledWorkspaceSessions;
      const previousCatalogSessions =
        prevShellState?.shellState.shell.catalog.reconciledWorkspaceSessions;

      if (
        nextCatalogSessions &&
        nextCatalogSessions !== previousCatalogSessions
      ) {
        workspaceSessionStore
          .getState()
          .hydrateCatalogSessions(nextCatalogSessions);
      }
      listener();
    }),
    workspaceSessionStore.subscribe(() => listener()),
    uiInteractionStore.subscribe(() => listener()),
  ];

  queueMicrotask(() => {
    void workspaceSessionStore
      .getState()
      .setActiveWorktree(
        getActiveWorktree(getAppShellStore().getState().shellState.shell)?.id ??
          null,
      );
  });

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

function getSnapshot(): WindowStoreState {
  return getLayoutState(
    getAppShellStore().getState(),
    workspaceSessionStore.getState(),
  );
}

function getStoreAdapter(): WindowStoreAdapter {
  return {
    createWindow: workspaceSessionStore.getState().createWindow,
    closeWindow: workspaceSessionStore.getState().closeWindow,
    focusWindow: workspaceSessionStore.getState().focusWindow,
    moveWindow: workspaceSessionStore.getState().moveWindow,
    resizeWindow: workspaceSessionStore.getState().resizeWindow,
    updateWindow: workspaceSessionStore.getState().updateWindow,
    setDirty: workspaceSessionStore.getState().setDirty,
    setZoom: workspaceSessionStore.getState().setZoom,
    zoomIn: workspaceSessionStore.getState().zoomIn,
    zoomOut: workspaceSessionStore.getState().zoomOut,
    resetZoom: workspaceSessionStore.getState().resetZoom,
    setPan: workspaceSessionStore.getState().setPan,
    setDraggingWindowId(windowId) {
      uiInteractionStore.getState().setDraggingWindowId(windowId);
    },
    setResizingWindowId(windowId) {
      uiInteractionStore.getState().setResizingWindowId(windowId);
    },
    setSnapPreview(preview) {
      uiInteractionStore.getState().setSnapPreview(preview);
    },
    clearAll: workspaceSessionStore.getState().clearAll,
  };
}

export function useWindowStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const store = getStoreAdapter();

  return {
    state,
    store,
    createWindow: store.createWindow,
    closeWindow: store.closeWindow,
    focusWindow: store.focusWindow,
    moveWindow: store.moveWindow,
    resizeWindow: store.resizeWindow,
    updateWindow: store.updateWindow,
    setDirty: store.setDirty,
    setZoom: store.setZoom,
    zoomIn: store.zoomIn,
    zoomOut: store.zoomOut,
    resetZoom: store.resetZoom,
    setPan: store.setPan,
    setDraggingWindowId: store.setDraggingWindowId,
    setResizingWindowId: store.setResizingWindowId,
    setSnapPreview: store.setSnapPreview,
    clearAll: store.clearAll,
  };
}

export function useWindow(windowId: string | null): WorkspaceWindow | null {
  const { state } = useWindowStore();

  if (!windowId) return null;
  return state.layout.windows.find((w) => w.id === windowId) ?? null;
}

export function useWindowsByKind(
  kind: WorkspaceWindow["kind"],
): WorkspaceWindow[] {
  const { state } = useWindowStore();
  return state.layout.windows.filter((w) => w.kind === kind);
}

export function useFocusedWindow(): WorkspaceWindow | null {
  const { state } = useWindowStore();

  if (!state.layout.focusedWindowId) return null;
  return (
    state.layout.windows.find((w) => w.id === state.layout.focusedWindowId) ??
    null
  );
}

export { workspaceSessionStore };
export type { WorkspaceSessionStore };
