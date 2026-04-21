import type {
  AgentMessageSnapshot,
  CreateWindowAction,
  FileContent,
  WorkspaceSession,
} from "@pi-desktop/shared";
import {
  createEmptyWindowLayoutState,
  createEmptyWorkspaceSession,
} from "@pi-desktop/shared";
import { createStore } from "zustand/vanilla";
import {
  createInitialWindowStoreState,
  createWindowFromAction,
  type WindowCreationOptions,
  type WindowStoreState,
  type WindowUpdates,
  windowReducer,
} from "./window-store";

/**
 * Persistence schema version for the renderer workspace session model.
 *
 * The on-disk shape is owned by the main process persistence layer, so we
 * cannot rely on a version tag being present. The migration path here is
 * defensive: it accepts a loosely-typed `unknown` snapshot (optionally
 * wrapped in `{ schemaVersion, session }`) and returns a valid
 * `WorkspaceSession`, applying v1->current normalization as needed.
 *
 * Bump this constant when the shape changes and add a new branch to
 * `migrateWorkspaceSessionSnapshot`.
 */
export const WORKSPACE_SESSION_SCHEMA_VERSION = 2 as const;

export type WorkspaceSessionSchemaVersion = 1 | 2;

export interface VersionedWorkspaceSessionSnapshot {
  schemaVersion: WorkspaceSessionSchemaVersion;
  session: WorkspaceSession;
}

export type WorkspaceSessionSnapshot =
  | WorkspaceSession
  | VersionedWorkspaceSessionSnapshot;

type UnknownRecord = { [key: string]: unknown };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseSchemaVersion(value: unknown): WorkspaceSessionSchemaVersion {
  if (value === 1) {
    return 1;
  }
  if (value === 2) {
    return 2;
  }
  return 1;
}

function coerceBase(value: UnknownRecord): {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isFocused: boolean;
  state: "normal" | "minimized" | "maximized";
  linkColor?: "blue" | "green" | "orange" | "pink" | "purple" | "yellow";
  linkTargetIds?: string[];
} | null {
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.title !== "string") return null;
  if (typeof value.x !== "number") return null;
  if (typeof value.y !== "number") return null;
  if (typeof value.width !== "number") return null;
  if (typeof value.height !== "number") return null;
  if (typeof value.zIndex !== "number") return null;

  const state =
    value.state === "minimized" || value.state === "maximized"
      ? value.state
      : "normal";

  const linkColor =
    value.linkColor === "blue" ||
    value.linkColor === "green" ||
    value.linkColor === "orange" ||
    value.linkColor === "pink" ||
    value.linkColor === "purple" ||
    value.linkColor === "yellow"
      ? value.linkColor
      : undefined;

  const linkTargetIds = Array.isArray(value.linkTargetIds)
    ? value.linkTargetIds.filter((id): id is string => typeof id === "string")
    : undefined;

  return {
    id: value.id,
    title: value.title,
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    zIndex: value.zIndex,
    isFocused: value.isFocused === true,
    state,
    ...(linkColor ? { linkColor } : {}),
    ...(linkTargetIds ? { linkTargetIds } : {}),
  };
}

function coerceWindow(
  value: unknown,
): WorkspaceSession["layout"]["windows"][number] | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  // Drop legacy `search` windows during migration — the renderer no longer
  // supports them as persisted entries (they become launcher overlays).
  if (kind === "search") return null;

  const base = coerceBase(value);
  if (!base) return null;

  switch (kind) {
    case "file": {
      if (typeof value.filePath !== "string") return null;
      return {
        ...base,
        kind: "file",
        filePath: value.filePath,
        isDirty: value.isDirty === true,
        ...(typeof value.encoding === "string"
          ? { encoding: value.encoding }
          : {}),
        ...(typeof value.isReadOnly === "boolean"
          ? { isReadOnly: value.isReadOnly }
          : {}),
      };
    }
    case "terminal": {
      if (typeof value.terminalId !== "string") return null;
      const backend =
        value.backend === "shell" || value.backend === "pi"
          ? value.backend
          : "shell";
      return {
        ...base,
        kind: "terminal",
        terminalId: value.terminalId,
        backend,
        cwd: typeof value.cwd === "string" ? value.cwd : "",
      };
    }
    case "chat": {
      if (typeof value.threadId !== "string") return null;
      return { ...base, kind: "chat", threadId: value.threadId };
    }
    case "note": {
      if (typeof value.noteId !== "string") return null;
      return {
        ...base,
        kind: "note",
        noteId: value.noteId,
        isDirty: value.isDirty === true,
        ...(typeof value.storagePath === "string"
          ? { storagePath: value.storagePath }
          : {}),
      };
    }
    case "git": {
      if (typeof value.repositoryPath !== "string") return null;
      return {
        ...base,
        kind: "git",
        repositoryPath: value.repositoryPath,
      };
    }
    case "graph": {
      const rawFilters = isRecord(value.filters) ? value.filters : {};
      return {
        ...base,
        kind: "graph",
        filters: {
          showFiles: rawFilters.showFiles !== false,
          showTerminals: rawFilters.showTerminals !== false,
          showNotes: rawFilters.showNotes !== false,
          showThreadLinks: rawFilters.showThreadLinks !== false,
          showMentions: rawFilters.showMentions !== false,
        },
      };
    }
    case "image": {
      if (typeof value.filePath !== "string") return null;
      const dimensions =
        isRecord(value.dimensions) &&
        typeof value.dimensions.width === "number" &&
        typeof value.dimensions.height === "number"
          ? { width: value.dimensions.width, height: value.dimensions.height }
          : undefined;
      return {
        ...base,
        kind: "image",
        filePath: value.filePath,
        ...(dimensions ? { dimensions } : {}),
        ...(typeof value.mimeType === "string"
          ? { mimeType: value.mimeType }
          : {}),
      };
    }
    default:
      return null;
  }
}

function coerceLayout(value: unknown): WorkspaceSession["layout"] {
  const fallback = createEmptyWindowLayoutState();
  if (!isRecord(value)) {
    return fallback;
  }

  const rawWindows = Array.isArray(value.windows) ? value.windows : [];
  const windows = rawWindows
    .map(coerceWindow)
    .filter((w): w is WorkspaceSession["layout"]["windows"][number] => !!w);

  return {
    windows,
    nextZIndex:
      typeof value.nextZIndex === "number" && Number.isFinite(value.nextZIndex)
        ? value.nextZIndex
        : fallback.nextZIndex,
    focusedWindowId: stringOrNull(value.focusedWindowId),
    snapGridSize:
      typeof value.snapGridSize === "number" && value.snapGridSize > 0
        ? value.snapGridSize
        : fallback.snapGridSize,
    zoom:
      typeof value.zoom === "number" && value.zoom > 0
        ? value.zoom
        : fallback.zoom,
    panX: typeof value.panX === "number" ? value.panX : fallback.panX,
    panY: typeof value.panY === "number" ? value.panY : fallback.panY,
  };
}

function coerceStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

function coerceSidebar(value: unknown): WorkspaceSession["sidebar"] {
  if (!isRecord(value)) {
    return { activePanel: null, isCollapsed: false };
  }
  const activePanel = value.activePanel;
  const panel: WorkspaceSession["sidebar"]["activePanel"] =
    activePanel === "files" ||
    activePanel === "notes" ||
    activePanel === "search"
      ? activePanel
      : null;
  return {
    activePanel: panel,
    isCollapsed: value.isCollapsed === true,
  };
}

function coerceSearch(value: unknown): WorkspaceSession["search"] {
  if (!isRecord(value)) {
    return { query: "", selectedPath: null };
  }
  return {
    query: typeof value.query === "string" ? value.query : "",
    selectedPath: stringOrNull(value.selectedPath),
  };
}

function coerceFiles(value: unknown): WorkspaceSession["files"] {
  if (!isRecord(value)) {
    return {};
  }
  const out: WorkspaceSession["files"] = {};
  for (const [k, v] of Object.entries(value)) {
    if (!isRecord(v)) continue;
    if (typeof v.filePath !== "string") continue;
    out[k] = {
      filePath: v.filePath,
      scrollTop: typeof v.scrollTop === "number" ? v.scrollTop : 0,
    };
  }
  return out;
}

function coerceNotes(value: unknown): WorkspaceSession["notes"] {
  if (!isRecord(value)) {
    return {};
  }
  const out: WorkspaceSession["notes"] = {};
  for (const [k, v] of Object.entries(value)) {
    if (!isRecord(v)) continue;
    if (typeof v.noteId !== "string") continue;
    out[k] = {
      noteId: v.noteId,
      draft: typeof v.draft === "string" ? v.draft : "",
    };
  }
  return out;
}

function coerceRecoveryDrafts(
  value: unknown,
): WorkspaceSession["recoveryDrafts"] {
  if (!isRecord(value)) {
    return {};
  }
  const out: WorkspaceSession["recoveryDrafts"] = {};
  for (const [k, v] of Object.entries(value)) {
    if (!isRecord(v)) continue;
    const kind = v.kind;
    if (kind !== "thread" && kind !== "note") continue;
    if (typeof v.text !== "string") continue;
    if (typeof v.updatedAt !== "number") continue;
    out[k] = { kind, text: v.text, updatedAt: v.updatedAt };
  }
  return out;
}

function migrateRawSession(raw: unknown): WorkspaceSession {
  if (!isRecord(raw) || typeof raw.worktreeId !== "string") {
    return createEmptyWorkspaceSession("");
  }

  return {
    worktreeId: raw.worktreeId,
    layout: coerceLayout(raw.layout),
    sidebar: coerceSidebar(raw.sidebar),
    promptDrafts: coerceStringRecord(raw.promptDrafts),
    search: coerceSearch(raw.search),
    files: coerceFiles(raw.files),
    notes: coerceNotes(raw.notes),
    recoveryDrafts: coerceRecoveryDrafts(raw.recoveryDrafts),
  };
}

/**
 * Apply a v1 -> v2 migration to a normalized session. v2 guarantees:
 *   - no `search` kind windows in `layout.windows`
 *   - `focusedWindowId` points to an existing window or is null
 *
 * The concrete normalization already happens in `migrateRawSession` +
 * `sanitizeWorkspaceSessionLayout`; this hook exists so future versions
 * can plug in additional transforms without rewriting callers.
 */
function applyV1ToV2(session: WorkspaceSession): WorkspaceSession {
  const windows = session.layout.windows.filter((w) => w.kind !== "search");
  const focusedWindowId =
    session.layout.focusedWindowId &&
    windows.some((w) => w.id === session.layout.focusedWindowId)
      ? session.layout.focusedWindowId
      : null;
  return {
    ...session,
    layout: { ...session.layout, windows, focusedWindowId },
  };
}

/**
 * Run the full migration pipeline on an unknown persisted value.
 * Returns `null` if the value is unrecoverable (e.g. missing worktreeId).
 */
export function migrateWorkspaceSessionSnapshot(
  raw: unknown,
): WorkspaceSession | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  let version: WorkspaceSessionSchemaVersion = 1;
  let inner: unknown = raw;

  if (
    isRecord(raw) &&
    "schemaVersion" in raw &&
    "session" in raw &&
    isRecord(raw.session)
  ) {
    version = parseSchemaVersion(raw.schemaVersion);
    inner = raw.session;
  }

  let session = migrateRawSession(inner);
  if (!session.worktreeId) {
    return null;
  }

  if (version < 2) {
    session = applyV1ToV2(session);
  }

  return session;
}

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

function isLegacySearchWindow(
  window: WorkspaceSession["layout"]["windows"][number],
): boolean {
  return window.kind === "search";
}

function getFocusedWindowAfterSanitizingSearchWindows(
  windows: WorkspaceSession["layout"]["windows"],
  focusedWindowId: string | null,
): string | null {
  if (
    focusedWindowId &&
    windows.some((window) => window.id === focusedWindowId)
  ) {
    return focusedWindowId;
  }

  return (
    [...windows]
      .filter((window) => window.state !== "minimized")
      .sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null
  );
}

function sanitizeWorkspaceSessionLayout(
  layout: WorkspaceSession["layout"],
): WorkspaceSession["layout"] {
  const windows = layout.windows.filter(
    (window) => !isLegacySearchWindow(window),
  );

  if (windows.length === layout.windows.length) {
    return layout;
  }

  return {
    ...layout,
    windows,
    focusedWindowId: getFocusedWindowAfterSanitizingSearchWindows(
      windows,
      layout.focusedWindowId,
    ),
  };
}

function cloneSession(session: WorkspaceSession): RendererWorkspaceSession {
  const sanitizedLayout = sanitizeWorkspaceSessionLayout(session.layout);

  return {
    ...session,
    layout: {
      ...sanitizedLayout,
      windows: [...sanitizedLayout.windows],
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
  };
}

function toPersistedSession(
  session: RendererWorkspaceSession,
): WorkspaceSession {
  return {
    worktreeId: session.worktreeId,
    layout: sanitizeWorkspaceSessionLayout(session.layout),
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

function updateSessionRecord(
  sessionsByWorktreeId: Record<string, RendererWorkspaceSession>,
  worktreeId: string,
  updater: (session: RendererWorkspaceSession) => RendererWorkspaceSession,
): Record<string, RendererWorkspaceSession> {
  const currentSession = sessionsByWorktreeId[worktreeId];
  if (!currentSession) {
    return sessionsByWorktreeId;
  }

  return {
    ...sessionsByWorktreeId,
    [worktreeId]: updater(currentSession),
  };
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
    withSession(worktreeId, updater, options);
  }

  function withSession(
    worktreeId: string,
    updater: (session: RendererWorkspaceSession) => RendererWorkspaceSession,
    options?: { persist?: boolean },
  ): void {
    store.setState((state) => {
      if (!state.sessionsByWorktreeId[worktreeId]) {
        return state;
      }

      return {
        ...state,
        sessionsByWorktreeId: updateSessionRecord(
          state.sessionsByWorktreeId,
          worktreeId,
          updater,
        ),
      };
    });

    if (options?.persist !== false) {
      schedulePersist(worktreeId);
    }
  }

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
              [worktreeId]: cloneSession(
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
          [worktreeId]: mergeSession(
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
      withActiveSession((session) => {
        const closingWindow = session.layout.windows.find(
          (w) => w.id === windowId,
        );
        const nextSession = applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "CLOSE_WINDOW",
            payload: { windowId },
          }),
        );

        if (!closingWindow) {
          return nextSession;
        }

        const remainingWindows = nextSession.layout.windows;

        // Prune fileContents and noteContents keyed by windowId — they
        // are scoped to the window that is going away, so always drop.
        let fileContents = nextSession.fileContents;
        if (fileContents.has(windowId)) {
          fileContents = new Map(fileContents);
          fileContents.delete(windowId);
        }

        let noteContents = nextSession.noteContents;
        const noteIdForWindow =
          closingWindow.kind === "note" ? closingWindow.noteId : null;
        if (noteContents.has(windowId)) {
          noteContents = new Map(noteContents);
          noteContents.delete(windowId);
        }
        if (noteIdForWindow && noteIdForWindow !== windowId) {
          const otherReferences = remainingWindows.some(
            (w) => w.kind === "note" && w.noteId === noteIdForWindow,
          );
          if (!otherReferences && noteContents.has(noteIdForWindow)) {
            if (noteContents === nextSession.noteContents) {
              noteContents = new Map(noteContents);
            }
            noteContents.delete(noteIdForWindow);
          }
        }

        // Prune threadConversations keyed by threadId only if no other
        // chat window in the same session references it.
        let threadConversations = nextSession.threadConversations;
        if (closingWindow.kind === "chat") {
          const closingThreadId = closingWindow.threadId;
          const otherChatReferences = remainingWindows.some(
            (w) => w.kind === "chat" && w.threadId === closingThreadId,
          );
          if (
            !otherChatReferences &&
            threadConversations.has(closingThreadId)
          ) {
            threadConversations = new Map(threadConversations);
            threadConversations.delete(closingThreadId);
          }
        }

        // Prune notes persistent record too when no other note window
        // shares the same noteId (keeps persisted state in sync).
        let notes = nextSession.notes;
        if (noteIdForWindow) {
          const otherReferences = remainingWindows.some(
            (w) => w.kind === "note" && w.noteId === noteIdForWindow,
          );
          if (!otherReferences && windowId in notes) {
            notes = { ...notes };
            delete notes[windowId];
          }
        }

        return {
          ...nextSession,
          fileContents,
          noteContents,
          threadConversations,
          notes,
        };
      });
    },
    removeWorktreeSession(worktreeId) {
      const persistTimer = persistTimers.get(worktreeId);
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimers.delete(worktreeId);
      }
      set((state) => {
        if (!state.sessionsByWorktreeId[worktreeId]) {
          return state;
        }
        const { [worktreeId]: _removed, ...remaining } =
          state.sessionsByWorktreeId;
        return {
          ...state,
          sessionsByWorktreeId: remaining,
          ...(state.activeWorktreeId === worktreeId
            ? {
                activeWorktreeId: null,
                activeWorktreeVersion: state.activeWorktreeVersion + 1,
              }
            : {}),
        };
      });
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
    reorderWindows(fromIndex, toIndex) {
      withActiveSession((session) =>
        applyLayout(session, (windowState) =>
          windowReducer(windowState, {
            type: "REORDER_WINDOWS",
            payload: { fromIndex, toIndex },
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
