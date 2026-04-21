import type { WorkspaceSession } from "@pi-desktop/shared";
import {
  migrateWorkspaceSessionSnapshot,
  WORKSPACE_SESSION_SCHEMA_VERSION,
} from "@/stores/workspace-session-store";

export const SESSION_RECOVERY_STORAGE_KEY = "pi-desktop:session-recovery";
export const SESSION_RECOVERY_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_CHECKPOINTS = 3;
export const DEFAULT_AUTO_SAVE_INTERVAL_MS = 60_000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RecoveryCheckpoint {
  schemaVersion: number;
  recoverySchemaVersion: typeof SESSION_RECOVERY_SCHEMA_VERSION;
  timestamp: number;
  session: WorkspaceSession;
}

export interface SessionRecoveryOptions {
  storage?: StorageLike;
  maxCheckpoints?: number;
  autoSaveIntervalMs?: number;
  now?: () => number;
}

export interface SessionRecovery {
  saveCheckpoint(sessionSnapshot: WorkspaceSession): void;
  loadLastCheckpoint(): RecoveryCheckpoint | null;
  hasRecoverableSession(): boolean;
  clearRecovery(): void;
  getAutoSaveIntervalMs(): number;
}

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

function decodeCheckpoint(value: unknown): RecoveryCheckpoint | null {
  if (!isRecord(value)) return null;
  if (value.recoverySchemaVersion !== SESSION_RECOVERY_SCHEMA_VERSION)
    return null;
  if (typeof value.timestamp !== "number" || !Number.isFinite(value.timestamp))
    return null;
  if (typeof value.schemaVersion !== "number") return null;
  const migrated = migrateWorkspaceSessionSnapshot({
    schemaVersion: value.schemaVersion,
    session: value.session,
  });
  if (!migrated) return null;
  return {
    schemaVersion:
      value.schemaVersion === 1 || value.schemaVersion === 2
        ? value.schemaVersion
        : WORKSPACE_SESSION_SCHEMA_VERSION,
    recoverySchemaVersion: SESSION_RECOVERY_SCHEMA_VERSION,
    timestamp: value.timestamp,
    session: migrated,
  };
}

function readCheckpoints(storage: StorageLike): RecoveryCheckpoint[] {
  const raw = storage.getItem(SESSION_RECOVERY_STORAGE_KEY);
  if (raw === null) return [];
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) {
    storage.removeItem(SESSION_RECOVERY_STORAGE_KEY);
    return [];
  }
  const decoded: RecoveryCheckpoint[] = [];
  for (const entry of parsed) {
    const cp = decodeCheckpoint(entry);
    if (cp !== null) {
      decoded.push(cp);
    }
  }
  decoded.sort((a, b) => b.timestamp - a.timestamp);
  return decoded;
}

function writeCheckpoints(
  storage: StorageLike,
  checkpoints: RecoveryCheckpoint[],
  maxCheckpoints: number,
): void {
  const trimmed = checkpoints.slice(0, maxCheckpoints);
  try {
    storage.setItem(SESSION_RECOVERY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage quota exceeded — drop oldest and retry once
    if (trimmed.length > 1) {
      try {
        storage.setItem(
          SESSION_RECOVERY_STORAGE_KEY,
          JSON.stringify(trimmed.slice(0, -1)),
        );
      } catch {
        // Unrecoverable; clear everything
        storage.removeItem(SESSION_RECOVERY_STORAGE_KEY);
      }
    } else {
      storage.removeItem(SESSION_RECOVERY_STORAGE_KEY);
    }
  }
}

export function createSessionRecovery(
  options: SessionRecoveryOptions = {},
): SessionRecovery {
  const storage = options.storage ?? globalThis.localStorage;
  const maxCheckpoints = options.maxCheckpoints ?? DEFAULT_MAX_CHECKPOINTS;
  const autoSaveIntervalMs =
    options.autoSaveIntervalMs ?? DEFAULT_AUTO_SAVE_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());

  return {
    saveCheckpoint(sessionSnapshot) {
      const checkpoints = readCheckpoints(storage);
      const checkpoint: RecoveryCheckpoint = {
        schemaVersion: WORKSPACE_SESSION_SCHEMA_VERSION,
        recoverySchemaVersion: SESSION_RECOVERY_SCHEMA_VERSION,
        timestamp: now(),
        session: sessionSnapshot,
      };
      checkpoints.unshift(checkpoint);
      writeCheckpoints(storage, checkpoints, maxCheckpoints);
    },

    loadLastCheckpoint() {
      const checkpoints = readCheckpoints(storage);
      return checkpoints[0] ?? null;
    },

    hasRecoverableSession() {
      return readCheckpoints(storage).length > 0;
    },

    clearRecovery() {
      storage.removeItem(SESSION_RECOVERY_STORAGE_KEY);
    },

    getAutoSaveIntervalMs() {
      return autoSaveIntervalMs;
    },
  };
}
