import type { WorkspaceSession } from "@pi-desktop/shared";
import {
  migrateWorkspaceSessionSnapshot,
  WORKSPACE_SESSION_SCHEMA_VERSION,
  type WorkspaceSessionSchemaVersion,
} from "@/stores/workspace-session-store";

/**
 * localStorage-shaped surface so the store can be unit-tested with a stub.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export interface SnapshotLogger {
  warn: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

/**
 * Persisted snapshot record stored under one localStorage key per snapshot.
 */
export interface WorkspaceSnapshotRecord {
  /** Snapshot key id (millisecond timestamp). */
  ts: number;
  /** Schema version of the embedded session payload. */
  schemaVersion: WorkspaceSessionSchemaVersion;
  /** Optional human label (e.g. "auto" / "manual"). */
  label?: string;
  /** The renderer workspace session being captured. */
  session: WorkspaceSession;
}

/**
 * Lightweight metadata projection used by listings — does not include the
 * full session payload.
 */
export interface WorkspaceSnapshotMeta {
  ts: number;
  schemaVersion: WorkspaceSessionSchemaVersion;
  label?: string;
  worktreeId: string;
  windowCount: number;
  byteSize: number;
}

/**
 * Outcome of a `restore()` call. Splits cleanly into "no migration needed",
 * "migrated to current version", or "refused because newer than current".
 */
export type SnapshotRestoreResult =
  | { kind: "ok"; session: WorkspaceSession }
  | {
      kind: "migrated";
      session: WorkspaceSession;
      from: WorkspaceSessionSchemaVersion;
    }
  | {
      kind: "refused-newer";
      snapshotVersion: number;
      currentVersion: WorkspaceSessionSchemaVersion;
    }
  | { kind: "not-found" }
  | { kind: "corrupt"; reason: string };

export interface SnapshotStoreOptions {
  storage: StorageLike;
  /** Pulls the currently-active workspace session to snapshot. Returning null skips. */
  getActiveSession: () => WorkspaceSession | null;
  schemaVersion?: WorkspaceSessionSchemaVersion;
  /** Override key prefix; defaults to `pi-desktop:workspace-snapshot:`. */
  keyPrefix?: string;
  /** Maximum snapshots retained (rotating). Default 5. */
  maxSnapshots?: number;
  /** Per-snapshot byte cap. Default 1_000_000 (~1MB). */
  maxBytesPerSnapshot?: number;
  /** Total budget across snapshots. Default 4_500_000 (~4.5MB). */
  maxTotalBytes?: number;
  /** Time source for `Date.now()`. Useful in tests. */
  now?: () => number;
  logger?: SnapshotLogger;
}

export interface SnapshotStore {
  /** Persist a new snapshot of the currently-active session, rotating older ones. */
  create(label?: string): WorkspaceSnapshotMeta | null;
  /** Sorted newest-first list of snapshot metadata. */
  list(): WorkspaceSnapshotMeta[];
  /** Read full snapshot record (or null when missing/corrupt). */
  get(ts: number): WorkspaceSnapshotRecord | null;
  /** Decode + migrate (via workspace-session-store migrator) an existing snapshot. */
  restore(ts: number): SnapshotRestoreResult;
  /** Remove a single snapshot. Returns true when an entry was removed. */
  delete(ts: number): boolean;
  /** Wipe every snapshot owned by this store's prefix. */
  clear(): void;
  /** Start a periodic timer that calls `create("auto")`. Returns `stop`. */
  startPeriodic(intervalMs: number): () => void;
}

const DEFAULT_KEY_PREFIX = "pi-desktop:workspace-snapshot:";
const DEFAULT_MAX_SNAPSHOTS = 5;
const DEFAULT_MAX_BYTES_PER_SNAPSHOT = 1_000_000;
const DEFAULT_MAX_TOTAL_BYTES = 4_500_000;

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function decodeRecord(raw: string): WorkspaceSnapshotRecord | null {
  const parsed = safeParse(raw);
  if (!isRecord(parsed)) return null;
  const ts = parsed.ts;
  const schemaVersion = parsed.schemaVersion;
  const session = parsed.session;
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  if (schemaVersion !== 1 && schemaVersion !== 2) return null;
  if (!isRecord(session) || typeof session.worktreeId !== "string") return null;
  // We trust the structural shape here because the migrator will normalize on restore.
  // Build a record by re-validating the session through migration first.
  const migrated = migrateWorkspaceSessionSnapshot({
    schemaVersion,
    session,
  });
  if (!migrated) return null;
  const label = typeof parsed.label === "string" ? parsed.label : undefined;
  return {
    ts,
    schemaVersion,
    ...(label !== undefined ? { label } : {}),
    session: migrated,
  };
}

function bytesOf(serialized: string): number {
  // Use UTF-16 char count as a deterministic, dependency-free approximation.
  // localStorage in browsers stores UTF-16, so 2 bytes per char is a common
  // accounting heuristic. We use the raw length to stay deterministic in tests.
  return serialized.length;
}

export function createSnapshotStore(
  options: SnapshotStoreOptions,
): SnapshotStore {
  const storage = options.storage;
  const keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
  const maxSnapshots = Math.max(
    1,
    options.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS,
  );
  const maxBytesPerSnapshot =
    options.maxBytesPerSnapshot ?? DEFAULT_MAX_BYTES_PER_SNAPSHOT;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const now = options.now ?? (() => Date.now());
  const schemaVersion =
    options.schemaVersion ?? WORKSPACE_SESSION_SCHEMA_VERSION;
  const logger = options.logger;

  function listRawKeys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(keyPrefix)) {
        out.push(k);
      }
    }
    return out;
  }

  function readMeta(key: string): WorkspaceSnapshotMeta | null {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const decoded = decodeRecord(raw);
    if (decoded === null) {
      logger?.warn?.(`[snapshot-store] dropping unparseable entry ${key}`);
      storage.removeItem(key);
      return null;
    }
    const meta: WorkspaceSnapshotMeta = {
      ts: decoded.ts,
      schemaVersion: decoded.schemaVersion,
      worktreeId: decoded.session.worktreeId,
      windowCount: decoded.session.layout.windows.length,
      byteSize: bytesOf(raw),
    };
    if (decoded.label !== undefined) {
      meta.label = decoded.label;
    }
    return meta;
  }

  function listMeta(): WorkspaceSnapshotMeta[] {
    const metas: WorkspaceSnapshotMeta[] = [];
    for (const k of listRawKeys()) {
      const m = readMeta(k);
      if (m !== null) metas.push(m);
    }
    metas.sort((a, b) => b.ts - a.ts);
    return metas;
  }

  function keyFor(ts: number): string {
    return `${keyPrefix}${ts}`;
  }

  function rotateAndBudget(): void {
    let metas = listMeta();
    // Trim count first.
    while (metas.length > maxSnapshots) {
      const oldest = metas[metas.length - 1];
      if (oldest === undefined) break;
      storage.removeItem(keyFor(oldest.ts));
      metas = metas.slice(0, -1);
    }
    // Then trim by total byte budget, oldest-first.
    let total = metas.reduce((acc, m) => acc + m.byteSize, 0);
    while (total > maxTotalBytes && metas.length > 1) {
      const oldest = metas[metas.length - 1];
      if (oldest === undefined) break;
      storage.removeItem(keyFor(oldest.ts));
      total -= oldest.byteSize;
      metas = metas.slice(0, -1);
    }
  }

  function uniqueTs(): number {
    const base = now();
    const existing = new Set(listMeta().map((m) => m.ts));
    let candidate = base;
    while (existing.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }

  return {
    create(label) {
      const session = options.getActiveSession();
      if (session === null) {
        return null;
      }
      const ts = uniqueTs();
      const record: WorkspaceSnapshotRecord = {
        ts,
        schemaVersion,
        ...(label !== undefined ? { label } : {}),
        session,
      };
      const serialized = JSON.stringify(record);
      const size = bytesOf(serialized);
      if (size > maxBytesPerSnapshot) {
        logger?.warn?.(
          `[snapshot-store] refusing snapshot ${ts}: ${size}B exceeds per-snapshot cap ${maxBytesPerSnapshot}B`,
        );
        return null;
      }
      try {
        storage.setItem(keyFor(ts), serialized);
      } catch (err) {
        logger?.error?.(
          `[snapshot-store] storage.setItem failed for ${ts}`,
          err,
        );
        return null;
      }
      rotateAndBudget();
      const meta: WorkspaceSnapshotMeta = {
        ts,
        schemaVersion,
        worktreeId: session.worktreeId,
        windowCount: session.layout.windows.length,
        byteSize: size,
      };
      if (label !== undefined) {
        meta.label = label;
      }
      return meta;
    },
    list() {
      return listMeta();
    },
    get(ts) {
      const raw = storage.getItem(keyFor(ts));
      if (raw === null) return null;
      return decodeRecord(raw);
    },
    restore(ts) {
      const raw = storage.getItem(keyFor(ts));
      if (raw === null) return { kind: "not-found" };
      const parsed = safeParse(raw);
      if (!isRecord(parsed)) {
        return { kind: "corrupt", reason: "invalid json" };
      }
      const rawVersion = parsed.schemaVersion;
      if (typeof rawVersion === "number" && rawVersion > schemaVersion) {
        return {
          kind: "refused-newer",
          snapshotVersion: rawVersion,
          currentVersion: schemaVersion,
        };
      }
      const decoded = decodeRecord(raw);
      if (decoded === null) {
        return { kind: "corrupt", reason: "decode failure" };
      }
      if (decoded.schemaVersion < schemaVersion) {
        return {
          kind: "migrated",
          session: decoded.session,
          from: decoded.schemaVersion,
        };
      }
      return { kind: "ok", session: decoded.session };
    },
    delete(ts) {
      const k = keyFor(ts);
      if (storage.getItem(k) === null) return false;
      storage.removeItem(k);
      return true;
    },
    clear() {
      for (const k of listRawKeys()) {
        storage.removeItem(k);
      }
    },
    startPeriodic(intervalMs) {
      if (intervalMs <= 0) {
        return () => {};
      }
      const handle = setInterval(() => {
        try {
          this.create("auto");
        } catch (err) {
          logger?.error?.("[snapshot-store] periodic create failed", err);
        }
      }, intervalMs);
      return () => {
        clearInterval(handle);
      };
    },
  };
}
