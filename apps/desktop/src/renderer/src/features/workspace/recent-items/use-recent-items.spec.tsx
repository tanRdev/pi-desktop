// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  RecentFile,
  RecentThread,
  RecentWorkspace,
} from "./recent-items-store";
import { createRecentItemsStore } from "./recent-items-store";
import {
  useRecentFiles,
  useRecentThreads,
  useRecentWorkspaces,
} from "./use-recent-items";

function makeFile(id: string, label: string, path: string): RecentFile {
  return { id, label, path, accessedAt: Date.now() };
}

describe("useRecentFiles", () => {
  it("returns empty items initially", () => {
    const store = createRecentItemsStore(null);
    const { result } = renderHook(() => useRecentFiles(store));
    expect(result.current.items.pinned).toEqual([]);
    expect(result.current.items.recent).toEqual([]);
  });

  it("reflects added items", () => {
    const store = createRecentItemsStore(null);
    const { result } = renderHook(() => useRecentFiles(store));
    act(() => {
      result.current.add(makeFile("a", "file-a", "/a"));
    });
    expect(result.current.items.recent).toHaveLength(1);
    expect(result.current.items.recent[0]?.id).toBe("a");
  });

  it("reflects removed items", () => {
    const store = createRecentItemsStore(null);
    const { result } = renderHook(() => useRecentFiles(store));
    act(() => {
      result.current.add(makeFile("a", "file-a", "/a"));
    });
    act(() => {
      result.current.remove("a");
    });
    expect(result.current.items.recent).toHaveLength(0);
  });

  it("reflects pinned items", () => {
    const store = createRecentItemsStore(null);
    const { result } = renderHook(() => useRecentFiles(store));
    act(() => {
      result.current.add(makeFile("a", "file-a", "/a"));
    });
    act(() => {
      result.current.pin("a");
    });
    expect(result.current.items.pinned).toHaveLength(1);
    expect(result.current.items.recent).toHaveLength(0);
  });

  it("reflects unpinned items", () => {
    const store = createRecentItemsStore(null);
    const { result } = renderHook(() => useRecentFiles(store));
    act(() => {
      result.current.add(makeFile("a", "file-a", "/a"));
      result.current.pin("a");
    });
    act(() => {
      result.current.unpin("a");
    });
    expect(result.current.items.pinned).toHaveLength(0);
    expect(result.current.items.recent).toHaveLength(1);
  });
});

describe("useRecentWorkspaces", () => {
  it("returns workspace items", () => {
    const store = createRecentItemsStore(null);
    const { result } = renderHook(() => useRecentWorkspaces(store));
    act(() => {
      const workspace: RecentWorkspace = {
        id: "ws-1",
        label: "my-workspace",
        rootPath: "/workspaces/my-workspace",
        accessedAt: Date.now(),
      };
      store.add("workspaces", workspace);
    });
    expect(result.current.items.recent).toHaveLength(1);
    expect(result.current.items.recent[0]?.id).toBe("ws-1");
  });
});

describe("useRecentThreads", () => {
  it("returns thread items", () => {
    const store = createRecentItemsStore(null);
    const { result } = renderHook(() => useRecentThreads(store));
    act(() => {
      const thread: RecentThread = {
        id: "th-1",
        label: "my-thread",
        threadId: "thread-123",
        accessedAt: Date.now(),
      };
      store.add("threads", thread);
    });
    expect(result.current.items.recent).toHaveLength(1);
    expect(result.current.items.recent[0]?.id).toBe("th-1");
  });
});
