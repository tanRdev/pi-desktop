import {
  createEmptyWorkspaceSession,
  type WorkspaceSession,
} from "@pi-desktop/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSnapshotStore,
  type SnapshotStore,
  type StorageLike,
} from "./snapshot-store";

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

function withSession(
  worktreeId: string,
  patch?: Partial<WorkspaceSession>,
): WorkspaceSession {
  const base = createEmptyWorkspaceSession(worktreeId);
  return { ...base, ...patch };
}

interface Harness {
  storage: ReturnType<typeof createMemoryStorage>;
  store: SnapshotStore;
  session: WorkspaceSession;
  tick: () => void;
}

function makeHarness(overrides?: {
  maxSnapshots?: number;
  maxBytesPerSnapshot?: number;
  maxTotalBytes?: number;
  getSession?: () => WorkspaceSession | null;
}): Harness {
  const storage = createMemoryStorage();
  const session = withSession("wt-a");
  let fakeNow = 1_000_000;
  const store = createSnapshotStore({
    storage,
    getActiveSession: overrides?.getSession ?? (() => session),
    now: () => fakeNow,
    ...(overrides?.maxSnapshots !== undefined
      ? { maxSnapshots: overrides.maxSnapshots }
      : {}),
    ...(overrides?.maxBytesPerSnapshot !== undefined
      ? { maxBytesPerSnapshot: overrides.maxBytesPerSnapshot }
      : {}),
    ...(overrides?.maxTotalBytes !== undefined
      ? { maxTotalBytes: overrides.maxTotalBytes }
      : {}),
  });
  return {
    storage,
    store,
    session,
    tick: () => {
      fakeNow += 1000;
    },
  };
}

describe("createSnapshotStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a snapshot and lists it with metadata", () => {
    const h = makeHarness();
    const meta = h.store.create("manual");
    expect(meta).not.toBeNull();
    expect(meta?.worktreeId).toBe("wt-a");
    expect(meta?.schemaVersion).toBe(2);
    expect(meta?.label).toBe("manual");

    const list = h.store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.ts).toBe(meta?.ts);
  });

  it("skips creation when no active session is available", () => {
    const h = makeHarness({ getSession: () => null });
    expect(h.store.create()).toBeNull();
    expect(h.store.list()).toEqual([]);
  });

  it("rotates snapshots once maxSnapshots is exceeded, dropping oldest first", () => {
    const h = makeHarness({ maxSnapshots: 3 });
    for (let i = 0; i < 5; i++) {
      h.store.create(`s${i}`);
      h.tick();
    }
    const list = h.store.list();
    expect(list).toHaveLength(3);
    // Newest first
    const labels = list.map((m) => m.label);
    expect(labels).toEqual(["s4", "s3", "s2"]);
  });

  it("refuses per-snapshot when serialized size exceeds cap", () => {
    const h = makeHarness({ maxBytesPerSnapshot: 10 });
    const meta = h.store.create("too-big");
    expect(meta).toBeNull();
    expect(h.store.list()).toEqual([]);
  });

  it("trims total-byte budget by dropping oldest", () => {
    const h = makeHarness({ maxSnapshots: 10, maxTotalBytes: 400 });
    for (let i = 0; i < 5; i++) {
      h.store.create(`s${i}`);
      h.tick();
    }
    const list = h.store.list();
    // At least the oldest should be gone.
    expect(list.length).toBeLessThan(5);
    expect(list.length).toBeGreaterThanOrEqual(1);
    const total = list.reduce((acc, m) => acc + m.byteSize, 0);
    expect(total).toBeLessThanOrEqual(400);
  });

  it("restores an unchanged v2 snapshot as 'ok'", () => {
    const h = makeHarness();
    const meta = h.store.create();
    expect(meta).not.toBeNull();
    const result = h.store.restore(meta?.ts ?? 0);
    expect(result.kind).toBe("ok");
  });

  it("restores a v1 snapshot as 'migrated'", () => {
    const h = makeHarness();
    // Inject a v1 snapshot directly with a legacy 'search' window.
    const legacyRecord = {
      ts: 50,
      schemaVersion: 1,
      session: {
        ...withSession("wt-legacy"),
        layout: {
          windows: [
            {
              id: "w1",
              kind: "search",
              title: "Search",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              zIndex: 1,
              isFocused: false,
              state: "normal",
            },
          ],
          nextZIndex: 2,
          focusedWindowId: null,
          snapGridSize: 24,
          zoom: 1,
          panX: 0,
          panY: 0,
        },
      },
    };
    h.storage.setItem(
      "pi-desktop:workspace-snapshot:50",
      JSON.stringify(legacyRecord),
    );
    const result = h.store.restore(50);
    expect(result.kind).toBe("migrated");
    if (result.kind === "migrated") {
      expect(result.from).toBe(1);
      // v1->v2 migration drops search windows.
      expect(result.session.layout.windows).toEqual([]);
    }
  });

  it("refuses to restore a snapshot from a newer schema version", () => {
    const h = makeHarness();
    const futureRecord = {
      ts: 77,
      schemaVersion: 99,
      session: withSession("wt-future"),
    };
    h.storage.setItem(
      "pi-desktop:workspace-snapshot:77",
      JSON.stringify(futureRecord),
    );
    const result = h.store.restore(77);
    expect(result.kind).toBe("refused-newer");
    if (result.kind === "refused-newer") {
      expect(result.snapshotVersion).toBe(99);
      expect(result.currentVersion).toBe(2);
    }
  });

  it("returns 'not-found' for unknown ts", () => {
    const h = makeHarness();
    expect(h.store.restore(12345).kind).toBe("not-found");
  });

  it("returns 'corrupt' for invalid JSON", () => {
    const h = makeHarness();
    h.storage.setItem("pi-desktop:workspace-snapshot:1", "not-json");
    const result = h.store.restore(1);
    expect(result.kind).toBe("corrupt");
  });

  it("deletes an existing snapshot and returns true", () => {
    const h = makeHarness();
    const meta = h.store.create();
    const ts = meta?.ts ?? 0;
    expect(h.store.delete(ts)).toBe(true);
    expect(h.store.delete(ts)).toBe(false);
    expect(h.store.list()).toEqual([]);
  });

  it("clears all snapshots under prefix without touching unrelated keys", () => {
    const h = makeHarness();
    h.store.create("a");
    h.tick();
    h.store.create("b");
    h.storage.setItem("unrelated", "keep-me");
    h.store.clear();
    expect(h.store.list()).toEqual([]);
    expect(h.storage.getItem("unrelated")).toBe("keep-me");
  });

  it("assigns unique timestamps when now() collides with existing snapshot", () => {
    const h = makeHarness();
    const first = h.store.create("a");
    // No tick — creating again should still succeed with a bumped ts.
    const second = h.store.create("b");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.ts).not.toBe(first?.ts);
  });

  it("startPeriodic triggers auto-creates at the configured interval", () => {
    vi.useFakeTimers();
    try {
      const h = makeHarness();
      const stop = h.store.startPeriodic(1000);
      vi.advanceTimersByTime(3500);
      stop();
      const list = h.store.list();
      expect(list.length).toBe(3);
      for (const meta of list) {
        expect(meta.label).toBe("auto");
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
