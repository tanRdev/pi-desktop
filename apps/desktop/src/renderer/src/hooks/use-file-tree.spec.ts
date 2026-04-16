import type { FileEntry } from "@pi-desktop/shared/models/fs";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../test/mock-pi-desktop";
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
    expect(result.current.isRootLoading).toBe(false);
    expect(readDirectory).toHaveBeenCalledWith("/root");
  });

  it("does nothing when workspacePath is null", async () => {
    const readDirectory = vi.fn();
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree(null));

    expect(result.current.rootNodes).toEqual([]);
    expect(readDirectory).not.toHaveBeenCalled();
  });

  it("falls back to empty rootNodes when root load fails", async () => {
    const readDirectory = vi.fn(() => Promise.reject(new Error("nope")));
    installMockPiDesktop({ fs: { readDirectory } });

    const { result } = renderHook(() => useFileTree("/root"));

    await waitFor(() => {
      expect(result.current.isRootLoading).toBe(false);
    });
    expect(result.current.rootNodes).toEqual([]);
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

  it("logs and swallows errors when expanding a directory fails", async () => {
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

    const { result } = renderHook(() => useFileTree("/root"));
    await waitFor(() => expect(result.current.rootNodes).toHaveLength(1));

    await act(async () => {
      await result.current.toggleExpand("/root/src");
    });

    expect(result.current.expandedPaths.has("/root/src")).toBe(true);
    expect(result.current.rootNodes[0]?.children).toBeNull();
  });
});
