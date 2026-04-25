import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createEmptyWorkspaceSession,
  type WorkspaceSession,
} from "@pi-desktop/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceSessionStore,
  migrateWorkspaceSessionSnapshot,
  WORKSPACE_SESSION_SCHEMA_VERSION,
} from "./workspace-session-store";

function createDeps() {
  const saved: WorkspaceSession[] = [];
  return {
    saved,
    getWorkspaceSession: vi.fn(
      async (_worktreeId: string): Promise<unknown> => null,
    ),
    saveWorkspaceSession: vi.fn(
      async (session: WorkspaceSession): Promise<WorkspaceSession> => {
        saved.push(session);
        return session;
      },
    ),
    persistDelayMs: 0,
  };
}

describe("WORKSPACE_SESSION_SCHEMA_VERSION", () => {
  it("is the expected current schema version", () => {
    expect(WORKSPACE_SESSION_SCHEMA_VERSION).toBe(2);
  });
});

describe("migrateWorkspaceSessionSnapshot", () => {
  it("returns null for null/undefined", () => {
    expect(migrateWorkspaceSessionSnapshot(null)).toBeNull();
    expect(migrateWorkspaceSessionSnapshot(undefined)).toBeNull();
  });

  it("returns null for a payload missing worktreeId", () => {
    expect(migrateWorkspaceSessionSnapshot({ layout: {} })).toBeNull();
  });

  it("preserves a valid v2 session", () => {
    const session = createEmptyWorkspaceSession("wt-1");
    const result = migrateWorkspaceSessionSnapshot({
      schemaVersion: 2,
      session,
    });
    expect(result).not.toBeNull();
    expect(result?.worktreeId).toBe("wt-1");
    expect(result?.layout.windows).toEqual([]);
  });

  it("accepts an unversioned legacy session and coerces defaults", () => {
    const result = migrateWorkspaceSessionSnapshot({
      worktreeId: "wt-legacy",
      layout: {
        windows: [],
        nextZIndex: 0,
        focusedWindowId: null,
        snapGridSize: 0,
        zoom: -1,
        panX: 0,
        panY: 0,
      },
    });
    expect(result?.worktreeId).toBe("wt-legacy");
    expect(result?.layout.snapGridSize).toBeGreaterThan(0);
    expect(result?.layout.zoom).toBeGreaterThan(0);
  });

  it("drops legacy search windows during v1 -> v2 migration", () => {
    const result = migrateWorkspaceSessionSnapshot({
      schemaVersion: 1,
      session: {
        worktreeId: "wt-2",
        layout: {
          windows: [
            {
              id: "w-search",
              kind: "search",
              title: "Search",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              zIndex: 1,
              isFocused: false,
              state: "normal",
              query: "",
              results: [],
            },
            {
              id: "w-file",
              kind: "file",
              title: "file.ts",
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              zIndex: 2,
              isFocused: true,
              state: "normal",
              filePath: "/tmp/file.ts",
              isDirty: false,
            },
          ],
          nextZIndex: 3,
          focusedWindowId: "w-file",
          snapGridSize: 24,
          zoom: 1,
          panX: 0,
          panY: 0,
        },
        sidebar: { activePanel: null, isCollapsed: false },
        promptDrafts: {},
        search: { query: "", selectedPath: null },
        files: {},
        notes: {},
        recoveryDrafts: {},
      },
    });
    expect(result?.layout.windows).toHaveLength(1);
    expect(result?.layout.windows[0]?.kind).toBe("file");
    expect(result?.layout.focusedWindowId).toBe("w-file");
  });

  it("clears a dangling focusedWindowId when the target window is absent", () => {
    const result = migrateWorkspaceSessionSnapshot({
      schemaVersion: 1,
      session: {
        worktreeId: "wt-3",
        layout: {
          windows: [],
          nextZIndex: 1,
          focusedWindowId: "missing",
          snapGridSize: 24,
          zoom: 1,
          panX: 0,
          panY: 0,
        },
        sidebar: { activePanel: null, isCollapsed: false },
        promptDrafts: {},
        search: { query: "", selectedPath: null },
        files: {},
        notes: {},
        recoveryDrafts: {},
      },
    });
    expect(result?.layout.focusedWindowId).toBeNull();
  });

  it("drops malformed window entries", () => {
    const result = migrateWorkspaceSessionSnapshot({
      worktreeId: "wt-4",
      layout: {
        windows: [
          { kind: "file" /* missing required fields */ },
          "not-an-object",
          null,
        ],
        nextZIndex: 1,
        focusedWindowId: null,
        snapGridSize: 24,
        zoom: 1,
        panX: 0,
        panY: 0,
      },
    });
    expect(result?.layout.windows).toEqual([]);
  });
});

describe("createWorkspaceSessionStore", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("seeds an empty session synchronously when activating a new worktree", async () => {
    const deps = createDeps();
    const store = createWorkspaceSessionStore(deps);
    const promise = store.getState().setActiveWorktree("wt-new");
    // Synchronously, before the async load resolves, a session row must exist.
    expect(store.getState().sessionsByWorktreeId["wt-new"]).toBeDefined();
    expect(store.getState().activeWorktreeId).toBe("wt-new");
    await promise;
  });

  it("bumps activeWorktreeVersion on activation changes", async () => {
    const deps = createDeps();
    const store = createWorkspaceSessionStore(deps);
    const v0 = store.getState().activeWorktreeVersion;
    await store.getState().setActiveWorktree("wt-a");
    expect(store.getState().activeWorktreeVersion).toBe(v0 + 1);
    await store.getState().setActiveWorktree(null);
    expect(store.getState().activeWorktreeVersion).toBe(v0 + 2);
  });

  it("migrates a legacy persisted payload when loading", async () => {
    const legacy = {
      worktreeId: "wt-legacy",
      layout: {
        windows: [
          {
            id: "w-search",
            kind: "search",
            title: "Search",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            zIndex: 1,
            isFocused: false,
            state: "normal",
            query: "",
            results: [],
          },
        ],
        nextZIndex: 2,
        focusedWindowId: "w-search",
        snapGridSize: 24,
        zoom: 1,
        panX: 0,
        panY: 0,
      },
      sidebar: { activePanel: null, isCollapsed: false },
      promptDrafts: {},
      search: { query: "", selectedPath: null },
      files: {},
      notes: {},
      recoveryDrafts: {},
    };
    const deps = createDeps();
    deps.getWorkspaceSession = vi.fn(
      async (_id: string): Promise<unknown> => legacy,
    );
    const store = createWorkspaceSessionStore(deps);
    await store.getState().setActiveWorktree("wt-legacy");
    const session = store.getState().sessionsByWorktreeId["wt-legacy"];
    expect(session).toBeDefined();
    expect(session?.layout.windows).toEqual([]);
    expect(session?.layout.focusedWindowId).toBeNull();
  });

  it("hydrateCatalogSessions runs migration and stores sanitized sessions", () => {
    const deps = createDeps();
    const store = createWorkspaceSessionStore(deps);
    const legacy = {
      worktreeId: "wt-cat",
      layout: {
        windows: [],
        nextZIndex: 1,
        focusedWindowId: null,
        snapGridSize: 24,
        zoom: 1,
        panX: 0,
        panY: 0,
      },
      sidebar: { activePanel: null, isCollapsed: false },
      promptDrafts: {},
      search: { query: "", selectedPath: null },
      files: {},
      notes: {},
      recoveryDrafts: {},
    };
    store.getState().hydrateCatalogSessions([legacy]);
    expect(store.getState().sessionsByWorktreeId["wt-cat"]).toBeDefined();
  });

  it("removeWorktreeSession clears active pointer and session row", async () => {
    const deps = createDeps();
    const store = createWorkspaceSessionStore(deps);
    await store.getState().setActiveWorktree("wt-x");
    store.getState().removeWorktreeSession("wt-x");
    expect(store.getState().sessionsByWorktreeId["wt-x"]).toBeUndefined();
    expect(store.getState().activeWorktreeId).toBeNull();
  });

  it("createWindow throws when there is no active worktree", () => {
    const deps = createDeps();
    const store = createWorkspaceSessionStore(deps);
    expect(() =>
      store.getState().createWindow({ kind: "terminal", backend: "shell" }),
    ).toThrow();
  });

  it("setNoteContent updates both runtime map and persistent notes record", async () => {
    const deps = createDeps();
    const store = createWorkspaceSessionStore(deps);
    await store.getState().setActiveWorktree("wt-note");
    const created = store
      .getState()
      .createWindow({ kind: "note" }, undefined, undefined);
    store.getState().setNoteContent(created.id, "hello");
    const session = store.getState().sessionsByWorktreeId["wt-note"];
    expect(session?.noteContents.get(created.id)?.content).toBe("hello");
    expect(session?.notes[created.id]?.draft).toBe("hello");
  });

  it("delegates runtime content mutations through an extracted helper seam", async () => {
    const basePath = path.resolve("apps/desktop/src/renderer/src/stores");
    const [source, helperSource] = await Promise.all([
      readFile(path.join(basePath, "workspace-session-store.ts"), "utf8"),
      readFile(
        path.join(basePath, "workspace-session-store-content.ts"),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./workspace-session-store-content"');
    expect(source).toContain(
      "createThreadConversationUpdate(session, threadId, value)",
    );
    expect(source).toContain(
      "createFileContentUpdate(session, windowId, value)",
    );
    expect(source).toContain(
      "createNoteContentUpdate(session, windowId, content)",
    );
    expect(source).not.toContain("function resolveNoteId(");
    expect(source).not.toContain(
      "noteContents: new Map(session.noteContents).set(windowId, {",
    );

    expect(helperSource).toContain("export type ThreadConversationState");
    expect(helperSource).toContain(
      "export function createThreadConversationUpdate",
    );
    expect(helperSource).toContain("export function createFileContentUpdate");
    expect(helperSource).toContain("export function createNoteContentUpdate");
  });

  it("delegates close-window cleanup through an extracted helper seam", async () => {
    const basePath = path.resolve("apps/desktop/src/renderer/src/stores");
    const [source, helperSource] = await Promise.all([
      readFile(path.join(basePath, "workspace-session-store.ts"), "utf8"),
      readFile(
        path.join(basePath, "workspace-session-store-cleanup.ts"),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./workspace-session-store-cleanup"');
    expect(source).toContain(
      "return closeWorkspaceSessionWindow(session, windowId);",
    );
    expect(source).not.toContain(
      "const closingWindow = session.layout.windows.find(",
    );
    expect(source).not.toContain(
      "let threadConversations = nextSession.threadConversations",
    );

    expect(helperSource).toContain(
      "export function closeWorkspaceSessionWindow",
    );
    expect(helperSource).toContain('type: "CLOSE_WINDOW"');
    expect(helperSource).toContain(
      "threadConversations.delete(closingThreadId)",
    );
    expect(helperSource).toContain("noteContents.delete(noteIdForWindow)");
  });

  it("delegates session persistence helpers through an extracted helper seam", async () => {
    const basePath = path.resolve("apps/desktop/src/renderer/src/stores");
    const [source, helperSource] = await Promise.all([
      readFile(path.join(basePath, "workspace-session-store.ts"), "utf8"),
      readFile(
        path.join(basePath, "workspace-session-store-persistence.ts"),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./workspace-session-store-persistence"');
    expect(source).toContain("cloneWorkspaceSession(");
    expect(source).toContain("mergeWorkspaceSession(");
    expect(source).toContain("toPersistedWorkspaceSession(session)");
    expect(source).toContain(
      "applyWorkspaceSessionLayout(session, (windowState) =>",
    );
    expect(source).toContain(
      "updateSessionRecord: updateWorkspaceSessionRecord",
    );
    expect(source).not.toContain("function cloneSession(");
    expect(source).not.toContain("function mergeSession(");
    expect(source).not.toContain("function toPersistedSession(");
    expect(source).not.toContain("function applyLayout(");
    expect(source).not.toContain("function updateSessionRecord(");

    expect(helperSource).toContain("export function cloneWorkspaceSession");
    expect(helperSource).toContain("export function mergeWorkspaceSession");
    expect(helperSource).toContain(
      "export function toPersistedWorkspaceSession",
    );
    expect(helperSource).toContain(
      "export function applyWorkspaceSessionLayout",
    );
    expect(helperSource).toContain(
      "export function updateWorkspaceSessionRecord",
    );
  });

  it("delegates window action helpers through an extracted helper seam", async () => {
    const basePath = path.resolve("apps/desktop/src/renderer/src/stores");
    const [source, helperSource] = await Promise.all([
      readFile(path.join(basePath, "workspace-session-store.ts"), "utf8"),
      readFile(
        path.join(basePath, "workspace-session-store-window-actions.ts"),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./workspace-session-store-window-actions"');
    expect(source).toContain("focusWorkspaceSessionWindow(session, windowId)");
    expect(source).toContain(
      "moveWorkspaceSessionWindow(session, windowId, x, y)",
    );
    expect(source).toContain(
      "resizeWorkspaceSessionWindow(session, windowId, width, height)",
    );
    expect(source).toContain(
      "updateWorkspaceSessionWindow(session, windowId, updates)",
    );
    expect(source).toContain(
      "setWorkspaceSessionDirty(session, windowId, isDirty)",
    );
    expect(source).toContain("setWorkspaceSessionZoom(session, zoom)");
    expect(source).toContain("zoomWorkspaceSessionIn(session)");
    expect(source).toContain("zoomWorkspaceSessionOut(session)");
    expect(source).toContain("resetWorkspaceSessionZoom(session)");
    expect(source).toContain("setWorkspaceSessionPan(session, panX, panY)");
    expect(source).toContain(
      "reorderWorkspaceSessionWindows(session, fromIndex, toIndex)",
    );
    expect(source).toContain("clearWorkspaceSessionWindows(session)");
    expect(source).toContain(
      "updateWorkspaceSessionWindow(session, windowId, updates)",
    );
    expect(source).not.toContain('type: "FOCUS_WINDOW"');
    expect(source).not.toContain('type: "MOVE_WINDOW"');
    expect(source).not.toContain('type: "RESIZE_WINDOW"');
    expect(source).not.toContain('type: "UPDATE_WINDOW"');
    expect(source).not.toContain('type: "SET_DIRTY"');
    expect(source).not.toContain('type: "SET_ZOOM"');
    expect(source).not.toContain('type: "ZOOM_IN"');
    expect(source).not.toContain('type: "ZOOM_OUT"');
    expect(source).not.toContain('type: "RESET_ZOOM"');
    expect(source).not.toContain('type: "SET_PAN"');
    expect(source).not.toContain('type: "REORDER_WINDOWS"');
    expect(source).not.toContain("createInitialWindowStoreState().layout");

    expect(helperSource).toContain(
      "export function focusWorkspaceSessionWindow",
    );
    expect(helperSource).toContain(
      "export function moveWorkspaceSessionWindow",
    );
    expect(helperSource).toContain(
      "export function resizeWorkspaceSessionWindow",
    );
    expect(helperSource).toContain(
      "export function updateWorkspaceSessionWindow",
    );
    expect(helperSource).toContain("export function setWorkspaceSessionDirty");
    expect(helperSource).toContain("export function setWorkspaceSessionZoom");
    expect(helperSource).toContain("export function zoomWorkspaceSessionIn");
    expect(helperSource).toContain("export function zoomWorkspaceSessionOut");
    expect(helperSource).toContain("export function resetWorkspaceSessionZoom");
    expect(helperSource).toContain("export function setWorkspaceSessionPan");
    expect(helperSource).toContain(
      "export function reorderWorkspaceSessionWindows",
    );
    expect(helperSource).toContain(
      "export function clearWorkspaceSessionWindows",
    );
    expect(helperSource).toContain("applyWorkspaceSessionLayout(");
    expect(helperSource).toContain("windowReducer(windowState,");
  });

  it("delegates stateful session operations through an extracted helper seam", async () => {
    const basePath = path.resolve("apps/desktop/src/renderer/src/stores");
    const [source, helperSource] = await Promise.all([
      readFile(path.join(basePath, "workspace-session-store.ts"), "utf8"),
      readFile(
        path.join(basePath, "workspace-session-store-session-operations.ts"),
        "utf8",
      ),
    ]);

    expect(source).toContain(
      'from "./workspace-session-store-session-operations"',
    );
    expect(source).toContain("createWorkspaceSessionOperationHelpers<");
    expect(source).not.toContain("function schedulePersist(");
    expect(source).not.toContain("function withActiveSession(");
    expect(source).not.toContain("function withSession(");
    expect(source).not.toContain(
      "const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();",
    );
    expect(source).not.toContain(
      "const persistTimer = persistTimers.get(worktreeId);",
    );

    expect(helperSource).toContain(
      "export function createWorkspaceSessionOperationHelpers",
    );
    expect(helperSource).toContain("function schedulePersist(");
    expect(helperSource).toContain("function withActiveSession(");
    expect(helperSource).toContain("function withSession(");
    expect(helperSource).toContain("function removeWorktreeSession(");
  });
});
