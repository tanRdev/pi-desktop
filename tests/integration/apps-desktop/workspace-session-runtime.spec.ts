import { describe, expect, it, vi } from "vitest";
import {
  openFileWindowForWorktree,
  syncActiveThreadConversation,
  updateSearchWindowQueryForWorktree,
} from "../../../apps/desktop/src/renderer/src/stores/workspace-session-runtime";
import { createWorkspaceSessionStore } from "../../../apps/desktop/src/renderer/src/stores/workspace-session-store";
import type { FileContent, SearchResponse } from "../../../packages/shared/src";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

describe("workspace-session-runtime", () => {
  it("syncs active thread conversations into the specified worktree session", async () => {
    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
    });

    store
      .getState()
      .hydrateCatalogSessions([
        createEmptyWorkspaceSession("/tmp/repo-a"),
        createEmptyWorkspaceSession("/tmp/repo-b"),
      ]);

    syncActiveThreadConversation({
      sessionStore: store,
      worktreeId: "/tmp/repo-a",
      threadId: "thread-a",
      conversation: {
        messages: [],
        status: "streaming",
        lastError: null,
      },
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
      store.getState().sessionsByWorktreeId["/tmp/repo-b"]?.threadConversations
        .size,
    ).toBe(0);
  });

  it("loads file content back into the originating worktree session", async () => {
    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
    });

    store
      .getState()
      .hydrateCatalogSessions([
        createEmptyWorkspaceSession("/tmp/repo-a"),
        createEmptyWorkspaceSession("/tmp/repo-b"),
      ]);
    await store.getState().setActiveWorktree("/tmp/repo-a");

    let resolveReadFile: ((value: FileContent) => void) | undefined;
    const readFile = vi.fn(
      () =>
        new Promise<FileContent>((resolve) => {
          resolveReadFile = resolve;
        }),
    );

    const openPromise = openFileWindowForWorktree({
      sessionStore: store,
      windowActions: {
        createWindow: store.getState().createWindow,
        focusWindow: store.getState().focusWindow,
      },
      windows:
        store.getState().sessionsByWorktreeId["/tmp/repo-a"]?.layout.windows,
      worktreeId: "/tmp/repo-a",
      worktreePath: "/tmp/repo-a",
      filePath: "/tmp/repo-a/src/app.tsx",
      readFile,
    });

    const createdWindow = store
      .getState()
      .sessionsByWorktreeId["/tmp/repo-a"]?.layout.windows.find(
        (window) => window.kind === "file",
      );

    expect(createdWindow).toBeDefined();
    if (!createdWindow) {
      throw new Error("Expected file window to be created");
    }

    const createdWindowId = createdWindow.id;
    expect(
      store
        .getState()
        .sessionsByWorktreeId["/tmp/repo-a"]?.fileContents.get(createdWindowId),
    ).toEqual({
      content: null,
      isLoading: true,
      error: null,
    });

    await store.getState().setActiveWorktree("/tmp/repo-b");
    resolveReadFile?.({
      path: "/tmp/repo-a/src/app.tsx",
      content: "export const ok = true;",
      type: "text",
    });
    await openPromise;

    expect(
      store
        .getState()
        .sessionsByWorktreeId["/tmp/repo-a"]?.fileContents.get(createdWindowId),
    ).toEqual({
      content: {
        path: "/tmp/repo-a/src/app.tsx",
        content: "export const ok = true;",
        type: "text",
      },
      isLoading: false,
      error: null,
    });
    expect(
      store.getState().sessionsByWorktreeId["/tmp/repo-b"]?.fileContents.size,
    ).toBe(0);
  });

  it("ignores stale search responses and keeps the newest result set", async () => {
    const store = createWorkspaceSessionStore({
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
    });

    store
      .getState()
      .hydrateCatalogSessions([createEmptyWorkspaceSession("/tmp/repo-a")]);
    await store.getState().setActiveWorktree("/tmp/repo-a");
    const searchWindow = store.getState().createWindow({ kind: "search" });
    const pendingResolvers: Array<(value: SearchResponse) => void> = [];
    const searchFiles = vi.fn(
      () =>
        new Promise<SearchResponse>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    );
    const requestVersions = new Map<string, number>();

    const firstRequest = updateSearchWindowQueryForWorktree({
      sessionStore: store,
      requestVersions,
      worktreeId: "/tmp/repo-a",
      worktreePath: "/tmp/repo-a",
      windowId: searchWindow.id,
      query: "old",
      searchFiles,
    });
    const secondRequest = updateSearchWindowQueryForWorktree({
      sessionStore: store,
      requestVersions,
      worktreeId: "/tmp/repo-a",
      worktreePath: "/tmp/repo-a",
      windowId: searchWindow.id,
      query: "new",
      searchFiles,
    });

    pendingResolvers[0]?.({
      query: "old",
      results: [
        {
          path: "/tmp/repo-a/old.ts",
          name: "old.ts",
          score: 0.2,
          type: "file",
        },
      ],
      total: 1,
      duration: 1,
    });
    pendingResolvers[1]?.({
      query: "new",
      results: [
        {
          path: "/tmp/repo-a/new.ts",
          name: "new.ts",
          score: 0.9,
          type: "file",
        },
      ],
      total: 1,
      duration: 1,
    });
    await Promise.all([firstRequest, secondRequest]);

    const updatedSearchWindow = store
      .getState()
      .sessionsByWorktreeId["/tmp/repo-a"]?.layout.windows.find(
        (window) => window.id === searchWindow.id,
      );

    expect(updatedSearchWindow).toMatchObject({
      id: searchWindow.id,
      kind: "search",
      query: "new",
      results: [
        expect.objectContaining({
          path: "/tmp/repo-a/new.ts",
          name: "new.ts",
        }),
      ],
    });
    expect(
      store
        .getState()
        .sessionsByWorktreeId["/tmp/repo-a"]?.searchUiState.get(
          searchWindow.id,
        ),
    ).toEqual({
      isLoading: false,
      selectedIndex: 0,
    });
  });
});
