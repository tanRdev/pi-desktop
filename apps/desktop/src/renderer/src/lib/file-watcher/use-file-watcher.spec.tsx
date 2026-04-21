// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileChangeEvent } from "./file-watcher-stream";
import { useFileWatcher } from "./use-file-watcher";

function createMockWatch() {
  let callback: ((event: FileChangeEvent) => void) | null = null;
  const watchFn = vi.fn(
    (_path: string, cb: (event: FileChangeEvent) => void) => {
      callback = cb;
      return () => {
        callback = null;
      };
    },
  );
  return {
    watchFn,
    emit: (event: FileChangeEvent) => {
      if (callback) callback(event);
    },
  };
}

describe("useFileWatcher", () => {
  let mock: ReturnType<typeof createMockWatch>;

  beforeEach(() => {
    vi.useFakeTimers();
    mock = createMockWatch();
    Object.defineProperty(window, "piDesktop", {
      configurable: true,
      writable: true,
      value: {
        fs: {
          watch: mock.watchFn,
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts watching when workspacePath is provided", () => {
    const { result } = renderHook(() => useFileWatcher("/workspace/project"));
    expect(result.current.isWatching).toBe(true);
    expect(mock.watchFn).toHaveBeenCalledWith(
      "/workspace/project",
      expect.any(Function),
    );
  });

  it("does not watch when workspacePath is null", () => {
    const { result } = renderHook(() => useFileWatcher(null));
    expect(result.current.isWatching).toBe(false);
    expect(mock.watchFn).not.toHaveBeenCalled();
  });

  it("does not watch when workspacePath is undefined", () => {
    const { result } = renderHook(() => useFileWatcher());
    expect(result.current.isWatching).toBe(false);
    expect(mock.watchFn).not.toHaveBeenCalled();
  });

  it("receives debounced events", () => {
    const { result } = renderHook(() => useFileWatcher("/workspace/project"));

    act(() => {
      mock.emit({
        type: "modify",
        path: "/workspace/project/foo.ts",
        timestamp: 0,
      });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.lastEvent).not.toBeNull();
    expect(result.current.lastEvent?.type).toBe("modify");
    expect(result.current.lastEvent?.path).toBe("/workspace/project/foo.ts");
    expect(result.current.events).toHaveLength(1);
  });

  it("maintains a ring buffer of last 50 events", () => {
    const { result } = renderHook(() => useFileWatcher("/workspace/project"));

    for (let i = 0; i < 60; i++) {
      act(() => {
        mock.emit({
          type: "modify",
          path: `/workspace/project/file${i}.ts`,
          timestamp: 0,
        });
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    expect(result.current.events).toHaveLength(50);
    const firstEvent = result.current.events[0];
    if (!firstEvent) throw new Error("expected first event");
    expect(firstEvent.path).toContain("file10");
  });

  it("stops watching when workspacePath changes to null", () => {
    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useFileWatcher(path),
      { initialProps: { path: "/workspace/project" as string | null } },
    );

    expect(result.current.isWatching).toBe(true);

    rerender({ path: null as string | null });

    expect(result.current.isWatching).toBe(false);
    expect(result.current.events).toHaveLength(0);
    expect(result.current.lastEvent).toBeNull();
  });

  it("stops watching on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useFileWatcher("/workspace/project"),
    );

    expect(result.current.isWatching).toBe(true);
    unmount();
  });

  it("resets events when switching workspace paths", () => {
    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useFileWatcher(path),
      { initialProps: { path: "/workspace/a" } },
    );

    act(() => {
      mock.emit({ type: "modify", path: "/workspace/a/foo.ts", timestamp: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.events).toHaveLength(1);

    rerender({ path: "/workspace/b" });

    expect(result.current.events).toHaveLength(0);
    expect(result.current.lastEvent).toBeNull();
  });
});
