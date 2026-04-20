import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { StorageLike } from "../snapshots/snapshot-store";
import { useWorkspacePrefs } from "./use-workspace-prefs";

function createMemoryStorage(): StorageLike & {
  dump: () => Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    getItem(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    key(index) {
      const keys = Array.from(data.keys());
      return keys[index] ?? null;
    },
    dump: () => data,
  };
}

describe("useWorkspacePrefs", () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("returns default prefs when no prefs stored", () => {
    const { result } = renderHook(() =>
      useWorkspacePrefs({ worktreeId: "wt-1", storage }),
    );
    expect(result.current.prefs.schemaVersion).toBe(2);
    expect(result.current.prefs.sidebarWidth).toBeUndefined();
    expect(result.current.prefs.activePanel).toBeUndefined();
    expect(result.current.prefs.layout).toBeUndefined();
    expect(result.current.prefs.customShortcuts).toBeUndefined();
  });

  it("returns default prefs when worktreeId is null", () => {
    const { result } = renderHook(() =>
      useWorkspacePrefs({ worktreeId: null, storage }),
    );
    expect(result.current.prefs.schemaVersion).toBe(2);
    expect(result.current.prefs.sidebarWidth).toBeUndefined();
  });

  it("setPref updates a single preference", () => {
    const { result } = renderHook(() =>
      useWorkspacePrefs({ worktreeId: "wt-1", storage }),
    );

    act(() => {
      result.current.setPref("sidebarWidth", 320);
    });

    expect(result.current.prefs.sidebarWidth).toBe(320);
  });

  it("setPref preserves other preferences", () => {
    const { result } = renderHook(() =>
      useWorkspacePrefs({ worktreeId: "wt-1", storage }),
    );

    act(() => {
      result.current.setPref("sidebarWidth", 280);
    });
    act(() => {
      result.current.setPref("activePanel", "files");
    });

    expect(result.current.prefs.sidebarWidth).toBe(280);
    expect(result.current.prefs.activePanel).toBe("files");
  });

  it("setPref is a no-op when worktreeId is null", () => {
    const { result } = renderHook(() =>
      useWorkspacePrefs({ worktreeId: null, storage }),
    );

    act(() => {
      result.current.setPref("sidebarWidth", 320);
    });

    expect(result.current.prefs.sidebarWidth).toBeUndefined();
  });

  it("resetPrefs clears all prefs for the worktree", () => {
    const { result } = renderHook(() =>
      useWorkspacePrefs({ worktreeId: "wt-1", storage }),
    );

    act(() => {
      result.current.setPref("sidebarWidth", 280);
      result.current.setPref("layout", "compact");
    });
    expect(result.current.prefs.sidebarWidth).toBe(280);

    act(() => {
      result.current.resetPrefs();
    });

    expect(result.current.prefs.sidebarWidth).toBeUndefined();
    expect(result.current.prefs.layout).toBeUndefined();
  });

  it("resetPrefs is a no-op when worktreeId is null", () => {
    const { result } = renderHook(() =>
      useWorkspacePrefs({ worktreeId: null, storage }),
    );

    act(() => {
      result.current.resetPrefs();
    });

    expect(result.current.prefs.schemaVersion).toBe(2);
  });

  it("switching worktreeId loads correct prefs", () => {
    const { result, rerender } = renderHook(
      ({ worktreeId }) => useWorkspacePrefs({ worktreeId, storage }),
      { initialProps: { worktreeId: "wt-1" } },
    );

    act(() => {
      result.current.setPref("sidebarWidth", 200);
    });
    expect(result.current.prefs.sidebarWidth).toBe(200);

    rerender({ worktreeId: "wt-2" });
    expect(result.current.prefs.sidebarWidth).toBeUndefined();

    act(() => {
      result.current.setPref("sidebarWidth", 400);
    });
    expect(result.current.prefs.sidebarWidth).toBe(400);

    rerender({ worktreeId: "wt-1" });
    expect(result.current.prefs.sidebarWidth).toBe(200);
  });

  it("reads pre-existing prefs from storage", () => {
    storage.setItem(
      "pi-desktop:workspace-prefs:wt-1",
      JSON.stringify({
        schemaVersion: 2,
        sidebarWidth: 350,
        layout: "wide",
      }),
    );

    const { result } = renderHook(() =>
      useWorkspacePrefs({ worktreeId: "wt-1", storage }),
    );

    expect(result.current.prefs.sidebarWidth).toBe(350);
    expect(result.current.prefs.layout).toBe("wide");
  });
});
