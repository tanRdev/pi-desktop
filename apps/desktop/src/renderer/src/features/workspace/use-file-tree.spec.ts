// @vitest-environment jsdom
import type { FileEntry } from "@pi-desktop/shared/models/fs";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../../test/mock-pi-desktop";
import { useFileTree } from "./use-file-tree";

function entry(name: string, type: "file" | "directory" = "file"): FileEntry {
  return {
    name,
    path: `/root/${name}`,
    type,
  };
}

describe("useFileTree", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    uninstallMockPiDesktop();
    vi.restoreAllMocks();
  });

  it("loads root nodes from workspacePath", async () => {
    const readDirectory = vi.fn((path: string) =>
      Promise.resolve({
        path,
        entries: [entry("src", "directory"), entry("readme.md")],
      }),
    );
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));

    await waitFor(() => {
      expect(result.current.rootNodes).toHaveLength(2);
    });
    expect(result.current.rootState.status).toBe("ready");
    expect(result.current.isRootLoading).toBe(false);
    expect(readDirectory).toHaveBeenCalledWith("/root");
  });

  it("does nothing when workspacePath is null", async () => {
    const readDirectory = vi.fn();
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree(null));

    expect(result.current.rootState.status).toBe("unavailable");
    expect(result.current.rootNodes).toEqual([]);
    expect(readDirectory).not.toHaveBeenCalled();
  });

  it("exposes an error state when the root load fails", async () => {
    const readDirectory = vi.fn(() => Promise.reject(new Error("nope")));
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));

    await waitFor(() => {
      expect(result.current.rootState.status).toBe("error");
    });
    expect(result.current.rootNodes).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "[file-tree] Failed to load root directory:",
      expect.any(Error),
    );
  });

  it("clears a root error after a successful retry with an empty listing", async () => {
    let resolveRetry!: (value: { path: string; entries: [] }) => void;
    const retry = new Promise<{ path: string; entries: [] }>((resolve) => {
      resolveRetry = resolve;
    });
    const readDirectory = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockReturnValueOnce(retry);
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));
    await waitFor(() => {
      expect(result.current.rootState.status).toBe("error");
    });

    act(() => {
      result.current.refreshRoot();
    });
    expect(result.current.rootState.status).toBe("loading");

    await act(async () => {
      resolveRetry({ path: "/root", entries: [] });
    });
    expect(result.current.rootState.status).toBe("ready");
    expect(result.current.rootNodes).toEqual([]);
    expect(readDirectory).toHaveBeenCalledTimes(2);
  });

  it("ignores a late root response from the previous Worktree", async () => {
    let resolveOldRoot!: (value: {
      path: string;
      entries: FileEntry[];
    }) => void;
    const oldRoot = new Promise<{ path: string; entries: FileEntry[] }>(
      (resolve) => {
        resolveOldRoot = resolve;
      },
    );
    const readDirectory = vi.fn((path: string) => {
      if (path === "/old-root") return oldRoot;
      return Promise.resolve({
        path,
        entries: [
          { name: "new.ts", path: "/new-root/new.ts", type: "file" as const },
        ],
      });
    });
    installMockPiDesktop({ fs: { readDirectory } });

    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useFileTree(path),
      { initialProps: { path: "/old-root" } },
    );

    rerender({ path: "/new-root" });
    await waitFor(() => {
      expect(result.current.rootState.status).toBe("ready");
      expect(result.current.rootNodes[0]?.entry.name).toBe("new.ts");
    });

    await act(async () => {
      resolveOldRoot({
        path: "/old-root",
        entries: [{ name: "old.ts", path: "/old-root/old.ts", type: "file" }],
      });
    });
    expect(result.current.rootState.status).toBe("ready");
    expect(result.current.rootNodes[0]?.entry.name).toBe("new.ts");
  });

  it("toggleExpand loads a directory and adds it to expandedPaths", async () => {
    const readDirectory = vi.fn((path: string) => {
      if (path === "/root") {
        return Promise.resolve({
          path,
          entries: [entry("src", "directory")],
        });
      }
      return Promise.resolve({
        path,
        entries: [entry("index.ts")],
      });
    });
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));
    await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });

    expect(result.current.expandedPaths.has("/root/src")).toBe(true);
    expect(readDirectory).toHaveBeenCalledWith("/root/src");
    expect(result.current.rootNodes[0]?.children).toHaveLength(1);
  });

  it("toggleExpand removes a path when already expanded", async () => {
    const readDirectory = vi.fn((path: string) =>
      Promise.resolve({
        path,
        entries:
          path === "/root" ? [entry("src", "directory")] : [entry("a.ts")],
      }),
    );
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));
    await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });
    expect(result.current.expandedPaths.has("/root/src")).toBe(true);

    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });
    expect(result.current.expandedPaths.has("/root/src")).toBe(false);
  });

  it("toggleExpand uses cache on second expand of same path", async () => {
    const readDirectory = vi.fn((path: string) =>
      Promise.resolve({
        path,
        entries:
          path === "/root" ? [entry("src", "directory")] : [entry("a.ts")],
      }),
    );
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));
    await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });
    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });
    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });

    const srcCalls = readDirectory.mock.calls.filter(
      ([p]) => p === "/root/src",
    );
    expect(srcCalls).toHaveLength(1);
  });

  it("refreshDirectory reloads a nested directory", async () => {
    let srcCallCount = 0;
    const readDirectory = vi.fn((path: string) => {
      if (path === "/root") {
        return Promise.resolve({
          path,
          entries: [entry("src", "directory")],
        });
      }
      srcCallCount += 1;
      return Promise.resolve({
        path,
        entries: [entry(`file-${srcCallCount}.ts`)],
      });
    });
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));
    await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });
    await act(async () => {
      await result.current.refreshDirectory("/root/src");
    });

    expect(srcCallCount).toBe(2);
  });

  it("refreshRoot clears cache and reloads", async () => {
    const readDirectory = vi.fn((path: string) =>
      Promise.resolve({ path, entries: [entry("a")] }),
    );
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));
    await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

    await act(async () => {
      result.current.refreshRoot();
    });

    await waitFor(() => {
      const rootCalls = readDirectory.mock.calls.filter(([p]) => p === "/root");
      expect(rootCalls.length).toBeGreaterThanOrEqual(2);
    });
    expect(result.current.expandedPaths.size).toBe(0);
  });

  it("collapses and reports a directory when expansion fails", async () => {
    const readDirectory = vi.fn((path: string) => {
      if (path === "/root") {
        return Promise.resolve({
          path,
          entries: [entry("src", "directory")],
        });
      }
      return Promise.reject(new Error("denied"));
    });
    installMockPiDesktop({ fs: { readDirectory } });
    const onDirectoryLoadError = vi.fn();

    const { result } = renderHook(() =>
      useFileTree("/root", { onDirectoryLoadError }),
    );
    await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });

    expect(result.current.expandedPaths.has("/root/src")).toBe(false);
    expect(result.current.rootNodes[0]?.children).toBeNull();
    expect(onDirectoryLoadError).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "[file-tree] Failed to load directory: /root/src",
      expect.any(Error),
    );
  });

  describe("filter + flatRows", () => {
    it("flattens root nodes in order when no filter is set", async () => {
      const readDirectory = vi.fn((path: string) =>
        Promise.resolve({
          path,
          entries: [entry("a.ts"), entry("b.ts"), entry("c.ts")],
        }),
      );
      installMockPiDesktop({ fs: { readDirectory } });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(3));

      expect(result.current.flatRows.map((r) => r.entry.name)).toEqual([
        "a.ts",
        "b.ts",
        "c.ts",
      ]);
    });

    it("applies fuzzy filter on names", async () => {
      const readDirectory = vi.fn((path: string) =>
        Promise.resolve({
          path,
          entries: [entry("apple.ts"), entry("banana.ts"), entry("grape.ts")],
        }),
      );
      installMockPiDesktop({ fs: { readDirectory } });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(3));

      act(() => {
        result.current.setFilter("apl");
      });

      expect(result.current.flatRows.map((r) => r.entry.name)).toEqual([
        "apple.ts",
      ]);
    });

    it("auto-expands directories and keeps ancestor dirs visible when filtering", async () => {
      const readDirectory = vi.fn((path: string) => {
        if (path === "/root") {
          return Promise.resolve({
            path,
            entries: [entry("src", "directory")],
          });
        }
        return Promise.resolve({
          path,
          entries: [entry("target.ts"), entry("other.ts")],
        });
      });
      installMockPiDesktop({ fs: { readDirectory } });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

      // Load the child dir so it's in cache.
      await act(async () => {
        await result.current.toggleExpand("/root/src");
      });

      act(() => {
        result.current.setFilter("target");
      });

      const names = result.current.flatRows.map((r) => r.entry.name);
      expect(names).toContain("src");
      expect(names).toContain("target.ts");
      expect(names).not.toContain("other.ts");
    });
  });

  describe("selection", () => {
    it("setSingleSelection replaces selectedPath and clears multi-select", async () => {
      installMockPiDesktop({
        fs: {
          readDirectory: vi.fn((path: string) =>
            Promise.resolve({ path, entries: [entry("a.ts"), entry("b.ts")] }),
          ),
        },
      });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(2));

      act(() => {
        result.current.toggleMultiSelect("/root/a.ts");
        result.current.toggleMultiSelect("/root/b.ts");
      });
      expect(result.current.multiSelectedPaths.size).toBe(2);

      act(() => {
        result.current.setSingleSelection("/root/a.ts");
      });

      expect(result.current.selectedPath).toBe("/root/a.ts");
      expect(result.current.multiSelectedPaths.size).toBe(0);
    });

    it("toggleMultiSelect adds then removes a path", async () => {
      installMockPiDesktop({
        fs: {
          readDirectory: vi.fn((path: string) =>
            Promise.resolve({ path, entries: [entry("a.ts")] }),
          ),
        },
      });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

      act(() => {
        result.current.toggleMultiSelect("/root/a.ts");
      });
      expect(result.current.multiSelectedPaths.has("/root/a.ts")).toBe(true);

      act(() => {
        result.current.toggleMultiSelect("/root/a.ts");
      });
      expect(result.current.multiSelectedPaths.has("/root/a.ts")).toBe(false);
    });
  });

  describe("keyboard navigation", () => {
    it("ArrowDown moves selection to the next flat row", async () => {
      installMockPiDesktop({
        fs: {
          readDirectory: vi.fn((path: string) =>
            Promise.resolve({
              path,
              entries: [entry("a.ts"), entry("b.ts"), entry("c.ts")],
            }),
          ),
        },
      });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(3));

      act(() => {
        result.current.handleKeyDown({ key: "ArrowDown" });
      });
      expect(result.current.selectedPath).toBe("/root/a.ts");

      act(() => {
        result.current.handleKeyDown({ key: "ArrowDown" });
      });
      expect(result.current.selectedPath).toBe("/root/b.ts");
    });

    it("ArrowUp moves selection to the previous flat row", async () => {
      installMockPiDesktop({
        fs: {
          readDirectory: vi.fn((path: string) =>
            Promise.resolve({
              path,
              entries: [entry("a.ts"), entry("b.ts")],
            }),
          ),
        },
      });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(2));

      act(() => {
        result.current.setSingleSelection("/root/b.ts");
      });
      act(() => {
        result.current.handleKeyDown({ key: "ArrowUp" });
      });
      expect(result.current.selectedPath).toBe("/root/a.ts");
    });

    it("ArrowRight expands a collapsed directory at the cursor", async () => {
      const readDirectory = vi.fn((path: string) => {
        if (path === "/root") {
          return Promise.resolve({
            path,
            entries: [entry("src", "directory")],
          });
        }
        return Promise.resolve({ path, entries: [entry("index.ts")] });
      });
      installMockPiDesktop({ fs: { readDirectory } });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

      act(() => {
        result.current.setSingleSelection("/root/src");
      });

      await act(async () => {
        result.current.handleKeyDown({ key: "ArrowRight" });
        // let the async toggleExpand inside resolve
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(result.current.expandedPaths.has("/root/src")).toBe(true),
      );
    });

    it("ArrowLeft collapses an expanded directory at the cursor", async () => {
      const readDirectory = vi.fn((path: string) => {
        if (path === "/root") {
          return Promise.resolve({
            path,
            entries: [entry("src", "directory")],
          });
        }
        return Promise.resolve({ path, entries: [entry("index.ts")] });
      });
      installMockPiDesktop({ fs: { readDirectory } });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

      await act(async () => {
        await result.current.toggleExpand("/root/src");
      });
      act(() => {
        result.current.setSingleSelection("/root/src");
      });

      await act(async () => {
        result.current.handleKeyDown({ key: "ArrowLeft" });
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(result.current.expandedPaths.has("/root/src")).toBe(false),
      );
    });

    it("handleKeyDown returns false and does nothing when tree is empty", async () => {
      installMockPiDesktop({
        fs: {
          readDirectory: vi.fn((path: string) =>
            Promise.resolve({ path, entries: [] }),
          ),
        },
      });

      const { result } = renderHook(() => useFileTree("/root"));
      await waitFor(() => expect(result.current.isRootLoading).toBe(false));

      let handled = true;
      act(() => {
        handled = result.current.handleKeyDown({ key: "ArrowDown" });
      });
      expect(handled).toBe(false);
      expect(result.current.selectedPath).toBeNull();
    });
  });
});
