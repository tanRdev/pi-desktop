import {
  createEmptyWorkspaceSession,
  type WorkspaceSession,
} from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";
import { createSnapshotApi } from "./snapshot-api";
import { createSnapshotStore, type StorageLike } from "./snapshot-store";

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

function makeApi(overrides?: {
  apply?: (s: WorkspaceSession) => void;
  download?: (name: string, blob: Blob) => void;
}) {
  const storage = createMemoryStorage();
  const session = createEmptyWorkspaceSession("wt-api");
  let now = 500;
  const store = createSnapshotStore({
    storage,
    getActiveSession: () => session,
    now: () => now,
  });
  const applied: WorkspaceSession[] = [];
  const api = createSnapshotApi({
    store,
    applyRestoredSession:
      overrides?.apply ??
      ((s) => {
        applied.push(s);
      }),
    ...(overrides?.download ? { download: overrides.download } : {}),
  });
  return {
    storage,
    store,
    api,
    session,
    applied,
    tick: () => {
      now += 10;
    },
  };
}

describe("createSnapshotApi", () => {
  it("create() + list() round-trip", () => {
    const h = makeApi();
    const meta = h.api.create("manual");
    expect(meta).not.toBeNull();
    const list = h.api.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.ts).toBe(meta?.ts);
  });

  it("restore() applies the migrated session via callback", () => {
    const h = makeApi();
    const meta = h.api.create();
    const result = h.api.restore(meta?.ts ?? 0);
    expect(result.kind).toBe("ok");
    expect(h.applied).toHaveLength(1);
    expect(h.applied[0]?.worktreeId).toBe("wt-api");
  });

  it("restore() does not apply a refused-newer snapshot", () => {
    const h = makeApi();
    h.storage.setItem(
      "pi-desktop:workspace-snapshot:999",
      JSON.stringify({
        ts: 999,
        schemaVersion: 7,
        session: createEmptyWorkspaceSession("wt-future"),
      }),
    );
    const result = h.api.restore(999);
    expect(result.kind).toBe("refused-newer");
    expect(h.applied).toHaveLength(0);
  });

  it("delete() removes the snapshot", () => {
    const h = makeApi();
    const meta = h.api.create();
    expect(h.api.delete(meta?.ts ?? 0)).toBe(true);
    expect(h.api.list()).toEqual([]);
  });

  it("exportSnapshot() serializes to a JSON Blob and invokes download", () => {
    const download = vi.fn<(name: string, blob: Blob) => void>();
    const h = makeApi({ download });
    const meta = h.api.create();
    const ok = h.api.exportSnapshot(meta?.ts ?? 0);
    expect(ok).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    const [filename, blob] = download.mock.calls[0] ?? [];
    expect(filename).toContain("workspace-snapshot-wt-api");
    expect(filename).toMatch(/\.json$/);
    expect(blob).toBeInstanceOf(Blob);
    if (blob instanceof Blob) {
      expect(blob.type).toBe("application/json");
    }
  });

  it("exportSnapshot() returns false for unknown ts", () => {
    const download = vi.fn<(name: string, blob: Blob) => void>();
    const h = makeApi({ download });
    expect(h.api.exportSnapshot(42)).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it("get() returns the full decoded record", () => {
    const h = makeApi();
    const meta = h.api.create("manual");
    const record = h.api.get(meta?.ts ?? 0);
    expect(record).not.toBeNull();
    expect(record?.session.worktreeId).toBe("wt-api");
    expect(record?.label).toBe("manual");
  });
});
