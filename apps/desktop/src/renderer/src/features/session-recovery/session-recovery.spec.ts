import {
  createEmptyWorkspaceSession,
  type WorkspaceSession,
} from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import {
  createSessionRecovery,
  SESSION_RECOVERY_SCHEMA_VERSION,
  SESSION_RECOVERY_STORAGE_KEY,
  type SessionRecovery,
  type StorageLike,
} from "./session-recovery";

function createMemoryStorage(): StorageLike & {
  readonly length: number;
  clear: () => void;
  dump: () => Map<string, string>;
  key: (index: number) => string | null;
} {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    key(index) {
      const keys = Array.from(data.keys());
      return keys[index] ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
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
  recovery: SessionRecovery;
  tick: () => void;
}

function makeHarness(overrides?: {
  maxCheckpoints?: number;
  autoSaveIntervalMs?: number;
}): Harness {
  const storage = createMemoryStorage();
  let fakeNow = 1_000_000;
  const recovery = createSessionRecovery({
    storage,
    now: () => fakeNow,
    ...(overrides?.maxCheckpoints !== undefined
      ? { maxCheckpoints: overrides.maxCheckpoints }
      : {}),
    ...(overrides?.autoSaveIntervalMs !== undefined
      ? { autoSaveIntervalMs: overrides.autoSaveIntervalMs }
      : {}),
  });
  return {
    storage,
    recovery,
    tick: () => {
      fakeNow += 1000;
    },
  };
}

describe("createSessionRecovery", () => {
  it("saves and loads a checkpoint", () => {
    const h = makeHarness();
    const session = withSession("wt-1");
    h.recovery.saveCheckpoint(session);
    const cp = h.recovery.loadLastCheckpoint();
    expect(cp).not.toBeNull();
    expect(cp?.session.worktreeId).toBe("wt-1");
    expect(cp?.timestamp).toBe(1_000_000);
  });

  it("returns null from loadLastCheckpoint when nothing is stored", () => {
    const h = makeHarness();
    expect(h.recovery.loadLastCheckpoint()).toBeNull();
  });

  it("hasRecoverableSession returns false when no checkpoints exist", () => {
    const h = makeHarness();
    expect(h.recovery.hasRecoverableSession()).toBe(false);
  });

  it("hasRecoverableSession returns true after saving a checkpoint", () => {
    const h = makeHarness();
    h.recovery.saveCheckpoint(withSession("wt-a"));
    expect(h.recovery.hasRecoverableSession()).toBe(true);
  });

  it("clearRecovery removes all checkpoints", () => {
    const h = makeHarness();
    h.recovery.saveCheckpoint(withSession("wt-a"));
    h.tick();
    h.recovery.saveCheckpoint(withSession("wt-b"));
    expect(h.recovery.hasRecoverableSession()).toBe(true);
    h.recovery.clearRecovery();
    expect(h.recovery.hasRecoverableSession()).toBe(false);
    expect(h.recovery.loadLastCheckpoint()).toBeNull();
  });

  it("maintains a ring buffer with max 3 checkpoints by default", () => {
    const h = makeHarness();
    for (let i = 0; i < 5; i++) {
      h.recovery.saveCheckpoint(withSession(`wt-${i}`));
      h.tick();
    }
    const raw = h.storage.getItem(SESSION_RECOVERY_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? "[]");
    expect(parsed).toHaveLength(3);
  });

  it("configurable maxCheckpoints respects the cap", () => {
    const h = makeHarness({ maxCheckpoints: 2 });
    for (let i = 0; i < 4; i++) {
      h.recovery.saveCheckpoint(withSession(`wt-${i}`));
      h.tick();
    }
    const raw = h.storage.getItem(SESSION_RECOVERY_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? "[]");
    expect(parsed).toHaveLength(2);
  });

  it("loadLastCheckpoint returns the most recent checkpoint", () => {
    const h = makeHarness();
    h.recovery.saveCheckpoint(withSession("wt-old"));
    h.tick();
    h.recovery.saveCheckpoint(withSession("wt-new"));
    const cp = h.recovery.loadLastCheckpoint();
    expect(cp?.session.worktreeId).toBe("wt-new");
  });

  it("handles corrupt recovery data gracefully by returning null", () => {
    const h = makeHarness();
    h.storage.setItem(SESSION_RECOVERY_STORAGE_KEY, "not-json");
    expect(h.recovery.loadLastCheckpoint()).toBeNull();
    expect(h.recovery.hasRecoverableSession()).toBe(false);
  });

  it("handles corrupt JSON array with invalid entries by filtering them out", () => {
    const h = makeHarness();
    h.storage.setItem(
      SESSION_RECOVERY_STORAGE_KEY,
      JSON.stringify([{ garbage: true }, null, 42]),
    );
    expect(h.recovery.loadLastCheckpoint()).toBeNull();
    expect(h.recovery.hasRecoverableSession()).toBe(false);
  });

  it("includes schema version in stored checkpoints", () => {
    const h = makeHarness();
    h.recovery.saveCheckpoint(withSession("wt-sv"));
    const cp = h.recovery.loadLastCheckpoint();
    expect(cp?.schemaVersion).toBe(2);
    expect(cp?.recoverySchemaVersion).toBe(SESSION_RECOVERY_SCHEMA_VERSION);
  });

  it("migrates schema version when loading older checkpoints", () => {
    const h = makeHarness();
    const legacyRecord = {
      recoverySchemaVersion: 1,
      schemaVersion: 1,
      timestamp: 500,
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
      SESSION_RECOVERY_STORAGE_KEY,
      JSON.stringify([legacyRecord]),
    );
    const cp = h.recovery.loadLastCheckpoint();
    expect(cp).not.toBeNull();
    expect(cp?.session.layout.windows).toEqual([]);
  });

  it("auto-save interval defaults to 60000ms and is configurable", () => {
    const h1 = makeHarness();
    expect(h1.recovery.getAutoSaveIntervalMs()).toBe(60_000);
    const h2 = makeHarness({ autoSaveIntervalMs: 30_000 });
    expect(h2.recovery.getAutoSaveIntervalMs()).toBe(30_000);
  });
});
