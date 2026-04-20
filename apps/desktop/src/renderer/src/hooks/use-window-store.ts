/**
 * React hook for the window store.
 * Provides reactive access to the active worktree's layout state.
 */

import type { WindowLayoutState, WorkspaceWindow } from "@pi-desktop/shared";
import { getActiveWorktree } from "@pi-desktop/shared";
import type { ShellModelState } from "@pi-desktop/shell-model";
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

let workspaceSessionStoreInstance: WorkspaceSessionStore | null = null;
let didScheduleInitialWorktreeSync = false;
let cachedStoreAdapter: WindowStoreAdapter | null = null;

function getWorkspaceSessionStore(): WorkspaceSessionStore {
  if (workspaceSessionStoreInstance === null) {
    workspaceSessionStoreInstance = createWorkspaceSessionStore({
      getWorkspaceSession: (worktreeId) =>
        window.piDesktop.state.getWorkspaceSession(worktreeId),
      saveWorkspaceSession: (session) =>
        window.piDesktop.state.saveWorkspaceSession(session),
    });
  }
  return workspaceSessionStoreInstance;
}

/** @internal Test-only reset hook. */
export function __resetWorkspaceSessionStoreForTests(): void {
  workspaceSessionStoreInstance = null;
  didScheduleInitialWorktreeSync = false;
  cachedStoreAdapter = null;
}

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
  reorderWindows: WorkspaceSessionStoreState["reorderWindows"];
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
    getActiveWorktree(shellState.shellModel.getState().shell)?.id ??
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

function hasRelevantShellModelChange(
  shellState: ShellModelState,
  prevShellState: ShellModelState,
): boolean {
  return shellState !== prevShellState;
}

function hasRelevantWorkspaceSessionChange(
  state: WorkspaceSessionStoreState,
  previousState: WorkspaceSessionStoreState,
): boolean {
  if (
    state.activeWorktreeId !== previousState.activeWorktreeId ||
    state.activeWorktreeVersion !== previousState.activeWorktreeVersion
  ) {
    return true;
  }

  const activeWorktreeId = state.activeWorktreeId;
  if (!activeWorktreeId) {
    return false;
  }

  const nextSession = state.sessionsByWorktreeId[activeWorktreeId];
  const previousSession = previousState.sessionsByWorktreeId[activeWorktreeId];

  if (nextSession !== previousSession) {
    return nextSession?.layout !== previousSession?.layout;
  }

  return false;
}

function subscribe(listener: () => void): () => void {
  const workspaceSessionStore = getWorkspaceSessionStore();
  const appShellStore = getAppShellStore();
  const shellModel = appShellStore.getState().shellModel;
  let previousShell: ShellModelState = shellModel.getState();
  const unsubscribers = [
    shellModel.subscribe((shellState) => {
      const prevShellState = previousShell;
      previousShell = shellState;

      const nextWorktreeId = getActiveWorktree(shellState.shell)?.id ?? null;
      const prevWorktreeId =
        getActiveWorktree(prevShellState.shell)?.id ?? null;

      if (nextWorktreeId !== prevWorktreeId) {
        void syncActiveWorktreeSession({
          nextWorktreeId,
          previousWorktreeId: prevWorktreeId,
          sessionStore: workspaceSessionStore,
          uiStore: uiInteractionStore,
        }).catch((error) => {
          console.error("Failed to sync active worktree session:", error);
        });
      }

      const nextCatalogSessions =
        shellState.shell.catalog.reconciledWorkspaceSessions;
      const previousCatalogSessions =
        prevShellState.shell.catalog.reconciledWorkspaceSessions;

      if (
        nextCatalogSessions &&
        nextCatalogSessions !== previousCatalogSessions
      ) {
        workspaceSessionStore
          .getState()
          .hydrateCatalogSessions(nextCatalogSessions);
      }

      if (hasRelevantShellModelChange(shellState, prevShellState)) {
        listener();
      }
    }),
    appShellStore.subscribe((state, prevState) => {
      if (state.isShellReady !== prevState.isShellReady) {
        listener();
      }
    }),
    workspaceSessionStore.subscribe((state, previousState) => {
      if (hasRelevantWorkspaceSessionChange(state, previousState)) {
        listener();
      }
    }),
    uiInteractionStore.subscribe((state, previousState) => {
      if (
        state.draggingWindowId !== previousState.draggingWindowId ||
        state.resizingWindowId !== previousState.resizingWindowId ||
        state.snapPreview !== previousState.snapPreview
      ) {
        listener();
      }
    }),
  ];

  if (!didScheduleInitialWorktreeSync) {
    didScheduleInitialWorktreeSync = true;
    queueMicrotask(() => {
      void workspaceSessionStore
        .getState()
        .setActiveWorktree(
          getActiveWorktree(shellModel.getState().shell)?.id ?? null,
        );
    });
  }

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

function getSnapshot(): WindowStoreState {
  return getLayoutState(
    getAppShellStore().getState(),
    getWorkspaceSessionStore().getState(),
  );
}

function getStoreAdapter(): WindowStoreAdapter {
  if (cachedStoreAdapter !== null) {
    return cachedStoreAdapter;
  }

  const store = getWorkspaceSessionStore();
  cachedStoreAdapter = {
    createWindow: (...args) => store.getState().createWindow(...args),
    closeWindow: (...args) => store.getState().closeWindow(...args),
    focusWindow: (...args) => store.getState().focusWindow(...args),
    moveWindow: (...args) => store.getState().moveWindow(...args),
    resizeWindow: (...args) => store.getState().resizeWindow(...args),
    updateWindow: (...args) => store.getState().updateWindow(...args),
    setDirty: (...args) => store.getState().setDirty(...args),
    setZoom: (...args) => store.getState().setZoom(...args),
    zoomIn: (...args) => store.getState().zoomIn(...args),
    zoomOut: (...args) => store.getState().zoomOut(...args),
    resetZoom: (...args) => store.getState().resetZoom(...args),
    setPan: (...args) => store.getState().setPan(...args),
    reorderWindows: (...args) => store.getState().reorderWindows(...args),
    setDraggingWindowId(windowId) {
      uiInteractionStore.getState().setDraggingWindowId(windowId);
    },
    setResizingWindowId(windowId) {
      uiInteractionStore.getState().setResizingWindowId(windowId);
    },
    setSnapPreview(preview) {
      uiInteractionStore.getState().setSnapPreview(preview);
    },
    clearAll: (...args) => store.getState().clearAll(...args),
  };
  return cachedStoreAdapter;
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
    reorderWindows: store.reorderWindows,
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

export { getWorkspaceSessionStore };
export type { WorkspaceSessionStore };
