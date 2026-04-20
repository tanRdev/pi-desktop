// @vitest-environment jsdom
import {
  createEmptyWorkspaceSession,
  type WorkspaceSession,
} from "@pi-desktop/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSnapshotApi } from "./snapshot-api";
import {
  createSnapshotStore,
  type SnapshotRestoreResult,
  type StorageLike,
} from "./snapshot-store";
import { useSnapshots } from "./use-snapshots";

function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    getItem: (k) => (data.has(k) ? (data.get(k) ?? null) : null),
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
    key: (i) => Array.from(data.keys())[i] ?? null,
  };
}

function makeApi() {
  const storage = createMemoryStorage();
  const session = createEmptyWorkspaceSession("wt-hook");
  let now = 100;
  const store = createSnapshotStore({
    storage,
    getActiveSession: () => session,
    now: () => now,
  });
  const applied: WorkspaceSession[] = [];
  const api = createSnapshotApi({
    store,
    applyRestoredSession: (s) => {
      applied.push(s);
    },
    download: () => {},
  });
  return {
    api,
    applied,
    tick: () => {
      now += 10;
    },
  };
}

describe("useSnapshots", () => {
  it("exposes the current snapshot list", () => {
    const h = makeApi();
    h.api.create("a");
    const { result } = renderHook(() => useSnapshots(h.api));
    expect(result.current.snapshots).toHaveLength(1);
  });

  it("refreshes the list after create()", () => {
    const h = makeApi();
    const { result } = renderHook(() => useSnapshots(h.api));
    expect(result.current.snapshots).toHaveLength(0);
    act(() => {
      result.current.create("one");
    });
    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0]?.label).toBe("one");
  });

  it("refreshes the list after remove()", () => {
    const h = makeApi();
    const meta = h.api.create("x");
    const { result } = renderHook(() => useSnapshots(h.api));
    expect(result.current.snapshots).toHaveLength(1);
    act(() => {
      result.current.remove(meta?.ts ?? 0);
    });
    expect(result.current.snapshots).toHaveLength(0);
  });

  it("restore() returns the store result and applies the session", () => {
    const h = makeApi();
    const meta = h.api.create();
    const { result } = renderHook(() => useSnapshots(h.api));
    let outcome!: SnapshotRestoreResult;
    act(() => {
      outcome = result.current.restore(meta?.ts ?? 0);
    });
    expect(outcome.kind).toBe("ok");
    expect(h.applied).toHaveLength(1);
  });

  it("polls when pollMs is configured", () => {
    vi.useFakeTimers();
    try {
      const h = makeApi();
      const { result } = renderHook(() => useSnapshots(h.api, { pollMs: 50 }));
      expect(result.current.snapshots).toHaveLength(0);
      // Externally add a snapshot — hook won't see it until the poll fires.
      h.api.create("ext");
      expect(result.current.snapshots).toHaveLength(0);
      act(() => {
        vi.advanceTimersByTime(60);
      });
      expect(result.current.snapshots).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
