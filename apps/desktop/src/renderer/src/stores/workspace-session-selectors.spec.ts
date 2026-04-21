import { createEmptyWorkspaceSession } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import {
  memoizeLast,
  selectActiveWorkspaceLayout,
  selectActiveWorkspaceSession,
  selectActiveWorkspaceSidebarCollapsed,
  selectActiveWorkspaceSnapGridSize,
  selectFileWindowStateByWorktree,
  selectNoteWindowStateByWorktree,
  selectThreadConversationByWorktree,
} from "./workspace-session-selectors";
import type {
  FileWindowState,
  NoteWindowState,
  RendererWorkspaceSession,
  ThreadConversationState,
  WorkspaceSessionStoreState,
} from "./workspace-session-store";

function makeRendererSession(
  worktreeId: string,
  overrides: Partial<RendererWorkspaceSession> = {},
): RendererWorkspaceSession {
  const base = createEmptyWorkspaceSession(worktreeId);
  return {
    ...base,
    threadConversations: new Map(),
    fileContents: new Map(),
    noteContents: new Map(),
    ...overrides,
  };
}

function makeState(
  session: RendererWorkspaceSession | null,
): WorkspaceSessionStoreState {
  const sessionsByWorktreeId = session ? { [session.worktreeId]: session } : {};
  return {
    activeWorktreeId: session?.worktreeId ?? null,
    activeWorktreeVersion: 1,
    sessionsByWorktreeId,
    setActiveWorktree: async () => {},
    hydrateCatalogSessions: () => {},
    createWindow: () => {
      throw new Error("not used");
    },
    closeWindow: () => {},
    focusWindow: () => {},
    moveWindow: () => {},
    resizeWindow: () => {},
    updateWindow: () => {},
    setDirty: () => {},
    setZoom: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    resetZoom: () => {},
    setPan: () => {},
    reorderWindows: () => {},
    clearAll: () => {},
    setThreadConversation: () => {},
    setThreadConversationForWorktree: () => {},
    setFileContent: () => {},
    setFileContentForWorktree: () => {},
    setNoteContent: () => {},
    setNoteContentForWorktree: () => {},
    updateWindowForWorktree: () => {},
    removeWorktreeSession: () => {},
  };
}

describe("memoizeLast", () => {
  it("returns cached result when args are identical by reference", () => {
    let calls = 0;
    const memoed = memoizeLast((a: number, b: number) => {
      calls += 1;
      return a + b;
    });
    expect(memoed(1, 2)).toBe(3);
    expect(memoed(1, 2)).toBe(3);
    expect(calls).toBe(1);
  });

  it("recomputes when any argument changes", () => {
    let calls = 0;
    const memoed = memoizeLast((a: number, b: number) => {
      calls += 1;
      return a + b;
    });
    memoed(1, 2);
    memoed(1, 3);
    memoed(1, 3);
    expect(calls).toBe(2);
  });

  it("handles null and NaN inputs via Object.is", () => {
    let calls = 0;
    const memoed = memoizeLast((v: unknown) => {
      calls += 1;
      return v;
    });
    memoed(NaN);
    memoed(NaN);
    expect(calls).toBe(1);
    memoed(null);
    memoed(null);
    expect(calls).toBe(2);
  });
});

describe("workspace session selectors", () => {
  it("returns undefined for the active session when there is none", () => {
    expect(selectActiveWorkspaceSession(makeState(null))).toBeUndefined();
  });

  it("returns the empty layout fallback when there is no active session", () => {
    const layout = selectActiveWorkspaceLayout(makeState(null));
    expect(layout.windows).toEqual([]);
    expect(layout.snapGridSize).toBeGreaterThan(0);
  });

  it("selectActiveWorkspaceLayout returns a stable reference across calls", () => {
    const session = makeRendererSession("wt-1");
    const state = makeState(session);
    expect(selectActiveWorkspaceLayout(state)).toBe(
      selectActiveWorkspaceLayout(state),
    );
  });

  it("selectActiveWorkspaceSnapGridSize reflects the active layout", () => {
    const session = makeRendererSession("wt-1");
    session.layout = { ...session.layout, snapGridSize: 48 };
    expect(selectActiveWorkspaceSnapGridSize(makeState(session))).toBe(48);
  });

  it("selectActiveWorkspaceSidebarCollapsed defaults to false", () => {
    expect(selectActiveWorkspaceSidebarCollapsed(makeState(null))).toBe(false);
    const session = makeRendererSession("wt-1");
    session.sidebar = { ...session.sidebar, isCollapsed: true };
    expect(selectActiveWorkspaceSidebarCollapsed(makeState(session))).toBe(
      true,
    );
  });

  it("selectFileWindowStateByWorktree is stable when inputs are identical", () => {
    const fileState: FileWindowState = {
      content: null,
      isLoading: true,
      error: null,
    };
    const session = makeRendererSession("wt-1", {
      fileContents: new Map([["w-1", fileState]]),
    });
    const state = makeState(session);
    const a = selectFileWindowStateByWorktree(state, "wt-1", "w-1");
    const b = selectFileWindowStateByWorktree(state, "wt-1", "w-1");
    expect(a).toBe(b);
    expect(a).toBe(fileState);
  });

  it("selectThreadConversationByWorktree recomputes on different threadId", () => {
    const conv: ThreadConversationState = {
      messages: [],
      status: "idle",
      lastError: null,
    };
    const session = makeRendererSession("wt-1", {
      threadConversations: new Map([["t-1", conv]]),
    });
    const state = makeState(session);
    expect(selectThreadConversationByWorktree(state, "wt-1", "t-1")).toBe(conv);
    expect(
      selectThreadConversationByWorktree(state, "wt-1", "missing"),
    ).toBeUndefined();
  });

  it("selectNoteWindowStateByWorktree returns undefined for unknown worktree", () => {
    const note: NoteWindowState = { content: "hi", error: null };
    const session = makeRendererSession("wt-1", {
      noteContents: new Map([["w-note", note]]),
    });
    const state = makeState(session);
    expect(selectNoteWindowStateByWorktree(state, "wt-1", "w-note")).toBe(note);
    expect(
      selectNoteWindowStateByWorktree(state, "wt-missing", "w-note"),
    ).toBeUndefined();
    expect(
      selectNoteWindowStateByWorktree(state, null, "w-note"),
    ).toBeUndefined();
  });
});
