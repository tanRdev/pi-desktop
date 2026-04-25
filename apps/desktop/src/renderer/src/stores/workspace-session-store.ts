import type { CreateWindowAction, WorkspaceSession } from "@pi-desktop/shared";
import { createEmptyWorkspaceSession } from "@pi-desktop/shared";
import { createStore } from "zustand/vanilla";
import {
  createWindowFromAction,
  type WindowCreationOptions,
  type WindowUpdates,
  windowReducer,
} from "./window-store";
import { closeWorkspaceSessionWindow } from "./workspace-session-store-cleanup";
import {
  createFileContentUpdate,
  createNoteContentUpdate,
  createThreadConversationUpdate,
  type FileWindowState,
  type NoteWindowState,
  type ThreadConversationState,
} from "./workspace-session-store-content";
import { migrateWorkspaceSessionSnapshot } from "./workspace-session-store-migrations";
import {
  applyWorkspaceSessionLayout,
  cloneWorkspaceSession,
  mergeWorkspaceSession,
  toPersistedWorkspaceSession,
  updateWorkspaceSessionRecord,
} from "./workspace-session-store-persistence";
import { createWorkspaceSessionOperationHelpers } from "./workspace-session-store-session-operations";
import {
  clearWorkspaceSessionWindows,
  focusWorkspaceSessionWindow,
  moveWorkspaceSessionWindow,
  reorderWorkspaceSessionWindows,
  resetWorkspaceSessionZoom,
  resizeWorkspaceSessionWindow,
  setWorkspaceSessionDirty,
  setWorkspaceSessionPan,
  setWorkspaceSessionZoom,
  updateWorkspaceSessionWindow,
  zoomWorkspaceSessionIn,
  zoomWorkspaceSessionOut,
} from "./workspace-session-store-window-actions";

export type {
  FileWindowState,
  NoteWindowState,
  ThreadConversationState,
} from "./workspace-session-store-content";
export {
  migrateWorkspaceSessionSnapshot,
  type VersionedWorkspaceSessionSnapshot,
  WORKSPACE_SESSION_SCHEMA_VERSION,
  type WorkspaceSessionSchemaVersion,
  type WorkspaceSessionSnapshot,
} from "./workspace-session-store-migrations";

export interface RendererWorkspaceSession extends WorkspaceSession {
  threadConversations: Map<string, ThreadConversationState>;
  fileContents: Map<string, FileWindowState>;
  noteContents: Map<string, NoteWindowState>;
}

export interface WorkspaceSessionStoreDependencies {
  /**
   * Returns a persisted workspace session payload. The return type is
   * intentionally `unknown` — the store runs
   * `migrateWorkspaceSessionSnapshot` on every load so that legacy
   * schemas, missing fields, or stray `search` windows are handled
   * defensively. A value of `null`/`undefined` means "no stored session".
   */
  getWorkspaceSession(worktreeId: string): Promise<unknown>;
  saveWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession>;
  persistDelayMs?: number;
}

export interface WorkspaceSessionStoreState {
  activeWorktreeId: string | null;
  activeWorktreeVersion: number;
  sessionsByWorktreeId: Record<string, RendererWorkspaceSession>;
  setActiveWorktree(worktreeId: string | null): Promise<void>;
  hydrateCatalogSessions(sessions: readonly unknown[]): void;
  createWindow(
    action: CreateWindowAction,
    cwd?: string,
    options?: WindowCreationOptions,
  ): ReturnType<typeof createWindowFromAction>;
  closeWindow(windowId: string): void;
  focusWindow(windowId: string): void;
  moveWindow(windowId: string, x: number, y: number): void;
  resizeWindow(windowId: string, width: number, height: number): void;
  updateWindow(windowId: string, updates: WindowUpdates): void;
  setDirty(windowId: string, isDirty: boolean): void;
  setZoom(zoom: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  setPan(panX: number, panY: number): void;
  reorderWindows(fromIndex: number, toIndex: number): void;
  clearAll(): void;
  setThreadConversation(threadId: string, value: ThreadConversationState): void;
  setThreadConversationForWorktree(
    worktreeId: string,
    threadId: string,
    value: ThreadConversationState,
  ): void;
  setFileContent(windowId: string, value: FileWindowState): void;
  setFileContentForWorktree(
    worktreeId: string,
    windowId: string,
    value: FileWindowState,
  ): void;
  setNoteContent(windowId: string, content: string): void;
  setNoteContentForWorktree(
    worktreeId: string,
    windowId: string,
    content: string,
  ): void;
  updateWindowForWorktree(
    worktreeId: string,
    windowId: string,
    updates: WindowUpdates,
  ): void;
  removeWorktreeSession(worktreeId: string): void;
}

export type WorkspaceSessionStore = ReturnType<
  typeof createWorkspaceSessionStore
>;

export function createWorkspaceSessionStore({
  getWorkspaceSession,
  saveWorkspaceSession,
  persistDelayMs = 75,
}: WorkspaceSessionStoreDependencies) {
  let withActiveSession: (
    updater: (session: RendererWorkspaceSession) => RendererWorkspaceSession,
    options?: { persist?: boolean },
  ) => void = () => {
    throw new Error("Session operation helpers not initialized");
  };
  let withSession: (
    worktreeId: string,
    updater: (session: RendererWorkspaceSession) => RendererWorkspaceSession,
    options?: { persist?: boolean },
  ) => void = () => {
    throw new Error("Session operation helpers not initialized");
  };
  let removeWorktreeSessionState: (worktreeId: string) => void = () => {
    throw new Error("Session operation helpers not initialized");
  };

  const store = createStore<WorkspaceSessionStoreState>()((set, get) => ({
    activeWorktreeId: null,
    activeWorktreeVersion: 0,
    sessionsByWorktreeId: {},
    hydrateCatalogSessions(sessions) {
      const migrated = sessions
        .map((s) => migrateWorkspaceSessionSnapshot(s))
        .filter((s): s is WorkspaceSession => s !== null);
      set((state) => ({
        ...state,
        sessionsByWorktreeId: {
          ...state.sessionsByWorktreeId,
          ...Object.fromEntries(
            migrated.map((session) => [
              session.worktreeId,
              mergeWorkspaceSession(
                state.sessionsByWorktreeId[session.worktreeId],
                session,
              ),
            ]),
          ),
        },
      }));
    },
    async setActiveWorktree(worktreeId) {
      if (!worktreeId) {
        set((state) => ({
          activeWorktreeId: null,
          activeWorktreeVersion: state.activeWorktreeVersion + 1,
        }));
        return;
      }

      const previous = get();
      const nextVersion = previous.activeWorktreeVersion + 1;
      const alreadyHadSession = Object.hasOwn(
        previous.sessionsByWorktreeId,
        worktreeId,
      );

      // Seed an empty session synchronously so callers that depend on
      // `sessionsByWorktreeId[activeWorktreeId]` (e.g. `createWindow`,
      // `withActiveSession`) work immediately after `setActiveWorktree`
      // is invoked. Previously the store briefly held an
      // `activeWorktreeId` with no matching session row, causing actions
      // like "Open Terminal" to silently no-op during the startup window
      // while the persisted read was in flight.
      set((state) => ({
        ...state,
        activeWorktreeId: worktreeId,
        activeWorktreeVersion: nextVersion,
        sessionsByWorktreeId: alreadyHadSession
          ? state.sessionsByWorktreeId
          : {
              ...state.sessionsByWorktreeId,
              [worktreeId]: cloneWorkspaceSession(
                createEmptyWorkspaceSession(worktreeId),
              ),
            },
      }));

      // If we already had a hydrated session, we're done — nothing to
      // load. Runtime maps (thread conversations, file contents, note
      // drafts) and window layout are preserved across activations.
      if (alreadyHadSession) {
        return;
      }

      // Load the persisted session in the background and merge it into
      // the seeded empty row. If the active worktree changed while we
      // were waiting, bail out so we don't clobber a newer activation.
      const persisted = await getWorkspaceSession(worktreeId);
      if (get().activeWorktreeVersion !== nextVersion) {
        return;
      }
      const migrated = migrateWorkspaceSessionSnapshot(persisted);
      if (!migrated) {
        return;
      }

      set((state) => ({
        ...state,
        sessionsByWorktreeId: {
          ...state.sessionsByWorktreeId,
          [worktreeId]: mergeWorkspaceSession(
            state.sessionsByWorktreeId[worktreeId],
            migrated,
          ),
        },
      }));
    },
    createWindow(action, cwd, options) {
      let createdWindow: ReturnType<typeof createWindowFromAction> | null =
        null;
      withActiveSession((session) => {
        const nextWindow = createWindowFromAction(
          action,
          session.layout.windows,
          session.layout.nextZIndex,
          cwd,
          options,
        );
        createdWindow = nextWindow;
        return applyWorkspaceSessionLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "CREATE_WINDOW",
            payload: { window: nextWindow },
          }),
        );
      });

      if (!createdWindow) {
        throw new Error("Cannot create a window without an active worktree");
      }

      return createdWindow;
    },
    closeWindow(windowId) {
      withActiveSession((session) => {
        return closeWorkspaceSessionWindow(session, windowId);
      });
    },
    removeWorktreeSession(worktreeId) {
      removeWorktreeSessionState(worktreeId);
    },
    focusWindow(windowId) {
      withActiveSession((session) =>
        focusWorkspaceSessionWindow(session, windowId),
      );
    },
    moveWindow(windowId, x, y) {
      withActiveSession((session) =>
        moveWorkspaceSessionWindow(session, windowId, x, y),
      );
    },
    resizeWindow(windowId, width, height) {
      withActiveSession((session) =>
        resizeWorkspaceSessionWindow(session, windowId, width, height),
      );
    },
    updateWindow(windowId, updates) {
      withActiveSession((session) =>
        updateWorkspaceSessionWindow(session, windowId, updates),
      );
    },
    setDirty(windowId, isDirty) {
      withActiveSession((session) =>
        setWorkspaceSessionDirty(session, windowId, isDirty),
      );
    },
    setZoom(zoom) {
      withActiveSession((session) => setWorkspaceSessionZoom(session, zoom));
    },
    zoomIn() {
      withActiveSession((session) => zoomWorkspaceSessionIn(session));
    },
    zoomOut() {
      withActiveSession((session) => zoomWorkspaceSessionOut(session));
    },
    resetZoom() {
      withActiveSession((session) => resetWorkspaceSessionZoom(session));
    },
    setPan(panX, panY) {
      withActiveSession((session) =>
        setWorkspaceSessionPan(session, panX, panY),
      );
    },
    reorderWindows(fromIndex, toIndex) {
      withActiveSession((session) =>
        reorderWorkspaceSessionWindows(session, fromIndex, toIndex),
      );
    },
    clearAll() {
      withActiveSession((session) => clearWorkspaceSessionWindows(session), {
        persist: true,
      });
    },
    setThreadConversation(threadId, value) {
      withActiveSession(
        (session) => ({
          ...session,
          ...createThreadConversationUpdate(session, threadId, value),
        }),
        { persist: false },
      );
    },
    setThreadConversationForWorktree(worktreeId, threadId, value) {
      withSession(
        worktreeId,
        (session) => ({
          ...session,
          ...createThreadConversationUpdate(session, threadId, value),
        }),
        { persist: false },
      );
    },
    setFileContent(windowId, value) {
      withActiveSession(
        (session) => ({
          ...session,
          ...createFileContentUpdate(session, windowId, value),
        }),
        { persist: false },
      );
    },
    setFileContentForWorktree(worktreeId, windowId, value) {
      withSession(
        worktreeId,
        (session) => ({
          ...session,
          ...createFileContentUpdate(session, windowId, value),
        }),
        { persist: false },
      );
    },
    setNoteContent(windowId, content) {
      withActiveSession((session) => ({
        ...session,
        ...createNoteContentUpdate(session, windowId, content),
      }));
    },
    setNoteContentForWorktree(worktreeId, windowId, content) {
      withSession(worktreeId, (session) => ({
        ...session,
        ...createNoteContentUpdate(session, windowId, content),
      }));
    },
    updateWindowForWorktree(worktreeId, windowId, updates) {
      withSession(
        worktreeId,
        (session) => updateWorkspaceSessionWindow(session, windowId, updates),
        { persist: false },
      );
    },
  }));

  ({
    withActiveSession,
    withSession,
    removeWorktreeSession: removeWorktreeSessionState,
  } = createWorkspaceSessionOperationHelpers<
    WorkspaceSessionStoreState,
    RendererWorkspaceSession
  >({
    getState: store.getState,
    setState: store.setState,
    persistDelayMs,
    persistSession: async (session) => {
      await saveWorkspaceSession(toPersistedWorkspaceSession(session));
    },
    updateSessionRecord: updateWorkspaceSessionRecord,
  }));

  return store;
}
