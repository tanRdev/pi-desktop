import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceSessionStore } from "../../../apps/desktop/src/renderer/src/stores/workspace-session-store";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

describe("workspace-session-store", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("keeps runtime window state scoped to each worktree session", async () => {
    const sessionA = createEmptyWorkspaceSession("/tmp/repo-a");
    const sessionB = createEmptyWorkspaceSession("/tmp/repo-b");
    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
      persistDelayMs: 5,
    });

    store.getState().hydrateCatalogSessions([sessionA, sessionB]);
    await store.getState().setActiveWorktree("/tmp/repo-a");
    store.getState().setThreadConversation("thread-a", {
      messages: [],
      status: "ready",
      lastError: null,
    });
    store.getState().setFileContent("file-window-a", {
      content: null,
      isLoading: true,
      error: null,
    });

    await store.getState().setActiveWorktree("/tmp/repo-b");
    expect(
      store.getState().sessionsByWorktreeId["/tmp/repo-b"]?.threadConversations
        .size,
    ).toBe(0);
    expect(
      store.getState().sessionsByWorktreeId["/tmp/repo-b"]?.fileContents.size,
    ).toBe(0);

    await store.getState().setActiveWorktree("/tmp/repo-a");
    expect(
      store
        .getState()
        .sessionsByWorktreeId["/tmp/repo-a"]?.threadConversations.has(
          "thread-a",
        ),
    ).toBe(true);
    expect(
      store
        .getState()
        .sessionsByWorktreeId["/tmp/repo-a"]?.fileContents.has("file-window-a"),
    ).toBe(true);
  });

  it("persists the active session layout and note drafts without leaking runtime-only maps", async () => {
    vi.useFakeTimers();

    const saveWorkspaceSession = vi.fn(async (session) => session);
    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession,
      persistDelayMs: 25,
    });

    await store.getState().setActiveWorktree("/tmp/repo-a");
    const noteWindow = store.getState().createWindow({ kind: "note" });
    store.getState().setNoteContent(noteWindow.id, "Remember the migration");

    vi.advanceTimersByTime(25);
    await Promise.resolve();

    expect(saveWorkspaceSession).toHaveBeenCalledTimes(1);
    expect(saveWorkspaceSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        worktreeId: "/tmp/repo-a",
        layout: expect.objectContaining({
          windows: expect.arrayContaining([
            expect.objectContaining({ id: noteWindow.id, kind: "note" }),
          ]),
        }),
        notes: {
          [noteWindow.id]: {
            noteId: noteWindow.id,
            draft: "Remember the migration",
          },
        },
      }),
    );
  });

  it("writes async runtime state back to the originating worktree session", async () => {
    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
      persistDelayMs: 5,
    });

    store
      .getState()
      .hydrateCatalogSessions([
        createEmptyWorkspaceSession("/tmp/repo-a"),
        createEmptyWorkspaceSession("/tmp/repo-b"),
      ]);

    await store.getState().setActiveWorktree("/tmp/repo-b");
    store
      .getState()
      .setThreadConversationForWorktree("/tmp/repo-a", "thread-a", {
        messages: [],
        status: "streaming",
        lastError: null,
      });
    store.getState().setFileContentForWorktree("/tmp/repo-a", "file-window-a", {
      content: null,
      isLoading: false,
      error: "late result",
    });
    store
      .getState()
      .setSearchUiStateForWorktree("/tmp/repo-a", "search-window-a", {
        isLoading: false,
        selectedIndex: 2,
      });

    expect(
      store
        .getState()
        .sessionsByWorktreeId["/tmp/repo-a"]?.threadConversations.get(
          "thread-a",
        ),
    ).toEqual({
      messages: [],
      status: "streaming",
      lastError: null,
    });
    expect(
      store
        .getState()
        .sessionsByWorktreeId["/tmp/repo-a"]?.fileContents.get("file-window-a"),
    ).toEqual({
      content: null,
      isLoading: false,
      error: "late result",
    });
    expect(
      store
        .getState()
        .sessionsByWorktreeId["/tmp/repo-a"]?.searchUiState.get(
          "search-window-a",
        ),
    ).toEqual({
      isLoading: false,
      selectedIndex: 2,
    });
    expect(
      store.getState().sessionsByWorktreeId["/tmp/repo-b"]?.fileContents.size,
    ).toBe(0);
    expect(
      store.getState().sessionsByWorktreeId["/tmp/repo-b"]?.searchUiState.size,
    ).toBe(0);
  });

  it("updates late window state on the originating worktree session", async () => {
    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
      persistDelayMs: 5,
    });

    store
      .getState()
      .hydrateCatalogSessions([
        createEmptyWorkspaceSession("/tmp/repo-a"),
        createEmptyWorkspaceSession("/tmp/repo-b"),
      ]);

    await store.getState().setActiveWorktree("/tmp/repo-a");
    const searchWindow = store.getState().createWindow({ kind: "search" });

    await store.getState().setActiveWorktree("/tmp/repo-b");
    store.getState().updateWindowForWorktree("/tmp/repo-a", searchWindow.id, {
      query: "notes",
      results: [
        {
          path: "/tmp/repo-a/notes/today.md",
          name: "today.md",
          score: 0.93,
          type: "file",
        },
      ],
    });

    const updatedSearchWindow = store
      .getState()
      .sessionsByWorktreeId["/tmp/repo-a"]?.layout.windows.find(
        (window) => window.id === searchWindow.id,
      );

    expect(updatedSearchWindow).toMatchObject({
      id: searchWindow.id,
      kind: "search",
      query: "notes",
      results: [
        expect.objectContaining({
          path: "/tmp/repo-a/notes/today.md",
          name: "today.md",
        }),
      ],
    });
    expect(
      store.getState().sessionsByWorktreeId["/tmp/repo-b"]?.layout.windows,
    ).toHaveLength(0);
  });

  it("preserves runtime-only maps when catalog hydration refreshes a session", async () => {
    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
      persistDelayMs: 5,
    });

    const initialSession = createEmptyWorkspaceSession("/tmp/repo-a");
    initialSession.layout.snapGridSize = 16;
    store.getState().hydrateCatalogSessions([initialSession]);

    await store.getState().setActiveWorktree("/tmp/repo-a");
    store.getState().setThreadConversation("thread-a", {
      messages: [],
      status: "ready",
      lastError: null,
    });
    store.getState().setFileContent("file-window-a", {
      content: null,
      isLoading: true,
      error: null,
    });

    const refreshedSession = createEmptyWorkspaceSession("/tmp/repo-a");
    refreshedSession.layout.snapGridSize = 32;
    store.getState().hydrateCatalogSessions([refreshedSession]);

    const refreshed = store.getState().sessionsByWorktreeId["/tmp/repo-a"];

    expect(refreshed?.layout.snapGridSize).toBe(32);
    expect(refreshed?.threadConversations.has("thread-a")).toBe(true);
    expect(refreshed?.fileContents.has("file-window-a")).toBe(true);
  });
});
