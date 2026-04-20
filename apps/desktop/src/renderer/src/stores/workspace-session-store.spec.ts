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
});
