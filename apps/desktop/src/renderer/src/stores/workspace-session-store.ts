import type {
  AgentMessageSnapshot,
  CreateWindowAction,
  FileContent,
  WorkspaceSession,
} from "@pidesk/shared";
import { createEmptyWorkspaceSession } from "@pidesk/shared";
import { createStore } from "zustand/vanilla";
import {
  createInitialWindowStoreState,
  createWindowFromAction,
  type WindowCreationOptions,
  type WindowStoreState,
  type WindowUpdates,
  windowReducer,
} from "./window-store";

export type ThreadConversationState = {
  messages: AgentMessageSnapshot[];
  status: string;
  lastError: string | null;
};

export type FileWindowState = {
  content: FileContent | null;
  isLoading: boolean;
  error: string | null;
};

export type NoteWindowState = {
  content: string;
  error: string | null;
};

export type SearchUiState = {
  isLoading: boolean;
  selectedIndex: number;
};

export interface RendererWorkspaceSession extends WorkspaceSession {
  threadConversations: Map<string, ThreadConversationState>;
  fileContents: Map<string, FileWindowState>;
  noteContents: Map<string, NoteWindowState>;
  searchUiState: Map<string, SearchUiState>;
}

export interface WorkspaceSessionStoreDependencies {
  getWorkspaceSession(worktreeId: string): Promise<WorkspaceSession | null>;
  saveWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession>;
  persistDelayMs?: number;
}

export interface WorkspaceSessionStoreState {
  activeWorktreeId: string | null;
  sessionsByWorktreeId: Record<string, RendererWorkspaceSession>;
  setActiveWorktree(worktreeId: string | null): Promise<void>;
  hydrateCatalogSessions(sessions: WorkspaceSession[]): void;
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
  setSearchUiState(windowId: string, value: SearchUiState): void;
  setSearchUiStateForWorktree(
    worktreeId: string,
    windowId: string,
    value: SearchUiState,
  ): void;
  updateWindowForWorktree(
    worktreeId: string,
    windowId: string,
    updates: WindowUpdates,
  ): void;
}

function cloneSession(session: WorkspaceSession): RendererWorkspaceSession {
  return {
    ...session,
    layout: {
      ...session.layout,
      windows: [...session.layout.windows],
    },
    sidebar: { ...session.sidebar },
    promptDrafts: { ...session.promptDrafts },
    search: { ...session.search },
    files: { ...session.files },
    notes: { ...session.notes },
    recoveryDrafts: { ...session.recoveryDrafts },
    threadConversations: new Map(),
    fileContents: new Map(),
    noteContents: new Map(
      Object.entries(session.notes).map(([windowId, note]) => [
        windowId,
        { content: note.draft, error: null },
      ]),
    ),
    searchUiState: new Map(),
  };
}

function mergeSession(
  currentSession: RendererWorkspaceSession | undefined,
  incomingSession: WorkspaceSession,
): RendererWorkspaceSession {
  const clonedSession = cloneSession(incomingSession);

  if (!currentSession) {
    return clonedSession;
  }

  return {
    ...clonedSession,
    threadConversations: currentSession.threadConversations,
    fileContents: currentSession.fileContents,
    noteContents: currentSession.noteContents,
    searchUiState: currentSession.searchUiState,
  };
}

function toPersistedSession(
  session: RendererWorkspaceSession,
): WorkspaceSession {
  return {
    worktreeId: session.worktreeId,
    layout: session.layout,
    sidebar: session.sidebar,
    promptDrafts: session.promptDrafts,
    search: session.search,
    files: session.files,
    notes: session.notes,
    recoveryDrafts: session.recoveryDrafts,
  };
}

function applyLayout(
  session: RendererWorkspaceSession,
  reducer: (state: WindowStoreState) => WindowStoreState,
): RendererWorkspaceSession {
  const nextState = reducer({
    layout: session.layout,
    snapPreview: null,
  });

  return {
    ...session,
    layout: nextState.layout,
  };
}

function resolveNoteId(
  session: RendererWorkspaceSession,
  windowId: string,
): string {
  const existingNoteId = session.notes[windowId]?.noteId;
  if (existingNoteId) {
    return existingNoteId;
  }

  const noteWindow = session.layout.windows.find(
    (window) => window.id === windowId && window.kind === "note",
  );
  return (
    (noteWindow?.kind === "note" ? noteWindow.noteId : undefined) ?? windowId
  );
}

export type WorkspaceSessionStore = ReturnType<
  typeof createWorkspaceSessionStore
>;

export function createWorkspaceSessionStore({
  getWorkspaceSession,
  saveWorkspaceSession,
  persistDelayMs = 75,
}: WorkspaceSessionStoreDependencies) {
  const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function schedulePersist(worktreeId: string): void {
    const existing = persistTimers.get(worktreeId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      persistTimers.delete(worktreeId);
      const session = store.getState().sessionsByWorktreeId[worktreeId];
      if (!session) {
        return;
      }
      void saveWorkspaceSession(toPersistedSession(session));
    }, persistDelayMs);

    persistTimers.set(worktreeId, timer);
  }

  function withActiveSession(
    updater: (session: RendererWorkspaceSession) => RendererWorkspaceSession,
    options?: { persist?: boolean },
  ): void {
    const worktreeId = store.getState().activeWorktreeId;
    if (!worktreeId) {
      return;
    }

    store.setState((state) => {
      const currentSession = state.sessionsByWorktreeId[worktreeId];
      if (!currentSession) {
        return state;
      }

      return {
        ...state,
        sessionsByWorktreeId: {
          ...state.sessionsByWorktreeId,
          [worktreeId]: updater(currentSession),
        },
      };
    });

    if (options?.persist !== false) {
      schedulePersist(worktreeId);
    }
  }

  function withSession(
    worktreeId: string,
    updater: (session: RendererWorkspaceSession) => RendererWorkspaceSession,
    options?: { persist?: boolean },
  ): void {
    store.setState((state) => {
      const currentSession = state.sessionsByWorktreeId[worktreeId];
      if (!currentSession) {
        return state;
      }

      return {
        ...state,
        sessionsByWorktreeId: {
          ...state.sessionsByWorktreeId,
          [worktreeId]: updater(currentSession),
        },
      };
    });

    if (options?.persist !== false) {
      schedulePersist(worktreeId);
    }
  }

  const store = createStore<WorkspaceSessionStoreState>()((set, get) => ({
    activeWorktreeId: null,
    sessionsByWorktreeId: {},
    hydrateCatalogSessions(sessions) {
      set((state) => ({
        ...state,
        sessionsByWorktreeId: {
          ...state.sessionsByWorktreeId,
          ...Object.fromEntries(
            sessions.map((session) => [
              session.worktreeId,
              mergeSession(
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
        set({ activeWorktreeId: null });
        return;
      }

      let session = get().sessionsByWorktreeId[worktreeId];
      if (!session) {
        const persisted = await getWorkspaceSession(worktreeId);
        session = cloneSession(
          persisted ?? createEmptyWorkspaceSession(worktreeId),
        );
      }

      set((state) => ({
        ...state,
        activeWorktreeId: worktreeId,
        sessionsByWorktreeId: {
          ...state.sessionsByWorktreeId,
          [worktreeId]: session,
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
        return applyLayout(session, (windowState) =>
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
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "CLOSE_WINDOW",
            payload: { windowId },
          }),
        ),
      );
    },
    focusWindow(windowId) {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "FOCUS_WINDOW",
            payload: { windowId },
          }),
        ),
      );
    },
    moveWindow(windowId, x, y) {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "MOVE_WINDOW",
            payload: { windowId, x, y },
          }),
        ),
      );
    },
    resizeWindow(windowId, width, height) {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "RESIZE_WINDOW",
            payload: { windowId, width, height },
          }),
        ),
      );
    },
    updateWindow(windowId, updates) {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "UPDATE_WINDOW",
            payload: { windowId, updates },
          }),
        ),
      );
    },
    setDirty(windowId, isDirty) {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "SET_DIRTY",
            payload: { windowId, isDirty },
          }),
        ),
      );
    },
    setZoom(zoom) {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "SET_ZOOM",
            payload: { zoom },
          }),
        ),
      );
    },
    zoomIn() {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, { type: "ZOOM_IN" }),
        ),
      );
    },
    zoomOut() {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, { type: "ZOOM_OUT" }),
        ),
      );
    },
    resetZoom() {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, { type: "RESET_ZOOM" }),
        ),
      );
    },
    setPan(panX, panY) {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "SET_PAN",
            payload: { panX, panY },
          }),
        ),
      );
    },
    clearAll() {
      withActiveSession(
        (session) => ({
          ...session,
          layout: createInitialWindowStoreState().layout,
        }),
        { persist: true },
      );
    },
    setThreadConversation(threadId, value) {
      withActiveSession(
        (session) => ({
          ...session,
          threadConversations: new Map(session.threadConversations).set(
            threadId,
            value,
          ),
        }),
        { persist: false },
      );
    },
    setThreadConversationForWorktree(worktreeId, threadId, value) {
      withSession(
        worktreeId,
        (session) => ({
          ...session,
          threadConversations: new Map(session.threadConversations).set(
            threadId,
            value,
          ),
        }),
        { persist: false },
      );
    },
    setFileContent(windowId, value) {
      withActiveSession(
        (session) => ({
          ...session,
          fileContents: new Map(session.fileContents).set(windowId, value),
        }),
        { persist: false },
      );
    },
    setFileContentForWorktree(worktreeId, windowId, value) {
      withSession(
        worktreeId,
        (session) => ({
          ...session,
          fileContents: new Map(session.fileContents).set(windowId, value),
        }),
        { persist: false },
      );
    },
    setNoteContent(windowId, content) {
      withActiveSession((session) => ({
        ...session,
        noteContents: new Map(session.noteContents).set(windowId, {
          content,
          error: null,
        }),
        notes: {
          ...session.notes,
          [windowId]: {
            noteId: resolveNoteId(session, windowId),
            draft: content,
          },
        },
      }));
    },
    setNoteContentForWorktree(worktreeId, windowId, content) {
      withSession(worktreeId, (session) => ({
        ...session,
        noteContents: new Map(session.noteContents).set(windowId, {
          content,
          error: null,
        }),
        notes: {
          ...session.notes,
          [windowId]: {
            noteId: resolveNoteId(session, windowId),
            draft: content,
          },
        },
      }));
    },
    setSearchUiState(windowId, value) {
      withActiveSession(
        (session) => ({
          ...session,
          searchUiState: new Map(session.searchUiState).set(windowId, value),
        }),
        { persist: false },
      );
    },
    setSearchUiStateForWorktree(worktreeId, windowId, value) {
      withSession(
        worktreeId,
        (session) => ({
          ...session,
          searchUiState: new Map(session.searchUiState).set(windowId, value),
        }),
        { persist: false },
      );
    },
    updateWindowForWorktree(worktreeId, windowId, updates) {
      withSession(
        worktreeId,
        (session) =>
          applyLayout(session, (windowState) =>
            windowReducer(windowState, {
              type: "UPDATE_WINDOW",
              payload: { windowId, updates },
            }),
          ),
        { persist: false },
      );
    },
  }));

  return store;
}
