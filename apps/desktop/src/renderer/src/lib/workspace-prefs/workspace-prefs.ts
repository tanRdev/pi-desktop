import type { StorageLike } from "@/features/snapshots/snapshot-store";

export const KEY_PREFIX = "pi-desktop:workspace-prefs:";
export const CURRENT_SCHEMA_VERSION = 2;

export type WorkspaceLayout = "default" | "compact" | "wide";

export interface WorkspacePrefsV1 {
  schemaVersion: 1;
  sidebarWidth?: number;
  activePanel?: string;
  customShortcuts?: Record<string, string>;
}

export interface WorkspacePrefsV2 {
  schemaVersion: 2;
  sidebarWidth?: number;
  activePanel?: string;
  layout?: WorkspaceLayout;
  customShortcuts?: Record<string, string>;
}

export type WorkspacePrefs = WorkspacePrefsV2;

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

export type WorkspacePrefKey = keyof Omit<WorkspacePrefs, "schemaVersion">;

type UnknownRecord = { [key: string]: unknown };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickNumber(source: UnknownRecord, key: string): number | undefined {
  const v = source[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function pickString(source: UnknownRecord, key: string): string | undefined {
  const v = source[key];
  return typeof v === "string" ? v : undefined;
}

function pickStringRecord(source: unknown): Record<string, string> | undefined {
  if (!isRecord(source)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function pickLayout(value: unknown): WorkspaceLayout | undefined {
  if (value === "default" || value === "compact" || value === "wide") {
    return value;
  }
  return undefined;
}

function migrateV1ToV2(raw: UnknownRecord): WorkspacePrefsV2 {
  const out: WorkspacePrefsV2 = { schemaVersion: 2 };
  const sidebarWidth = pickNumber(raw, "sidebarWidth");
  if (sidebarWidth !== undefined) out.sidebarWidth = sidebarWidth;
  const activePanel = pickString(raw, "activePanel");
  if (activePanel !== undefined) out.activePanel = activePanel;
  const customShortcuts = pickStringRecord(raw.customShortcuts);
  if (customShortcuts !== undefined) out.customShortcuts = customShortcuts;
  return out;
}

export function normalizeWorkspacePrefs(raw: unknown): WorkspacePrefs {
  if (!isRecord(raw)) return { ...DEFAULT_WORKSPACE_PREFS };

  const version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1;

  if (version < 2) {
    return migrateV1ToV2(raw);
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    return { ...DEFAULT_WORKSPACE_PREFS };
  }

  const out: WorkspacePrefsV2 = { schemaVersion: 2 };
  const sidebarWidth = pickNumber(raw, "sidebarWidth");
  if (sidebarWidth !== undefined) out.sidebarWidth = sidebarWidth;
  const activePanel = pickString(raw, "activePanel");
  if (activePanel !== undefined) out.activePanel = activePanel;
  const layout = pickLayout(raw.layout);
  if (layout !== undefined) out.layout = layout;
  const customShortcuts = pickStringRecord(raw.customShortcuts);
  if (customShortcuts !== undefined) out.customShortcuts = customShortcuts;
  return out;
}

function resolveStorage(): StorageLike | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  return globalThis.localStorage;
}

function storageKey(worktreeId: string): string {
  return `${KEY_PREFIX}${worktreeId}`;
}

export function getWorkspacePrefs(
  worktreeId: string,
  storage?: StorageLike,
): WorkspacePrefs {
  const store = storage ?? resolveStorage();
  if (!store) return { ...DEFAULT_WORKSPACE_PREFS };
  try {
    const raw = store.getItem(storageKey(worktreeId));
    if (raw === null) return { ...DEFAULT_WORKSPACE_PREFS };
    return normalizeWorkspacePrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORKSPACE_PREFS };
  }
}

export function setWorkspacePref(
  worktreeId: string,
  key: WorkspacePrefKey,
  value: WorkspacePrefs[WorkspacePrefKey],
  storage?: StorageLike,
): void {
  const store = storage ?? resolveStorage();
  if (!store) return;
  const current = getWorkspacePrefs(worktreeId, store);
  const updated: WorkspacePrefs = {
    ...current,
    [key]: value,
  };
  try {
    store.setItem(storageKey(worktreeId), JSON.stringify(updated));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function deleteWorkspacePrefs(
  worktreeId: string,
  storage?: StorageLike,
): void {
  const store = storage ?? resolveStorage();
  if (!store) return;
  try {
    store.removeItem(storageKey(worktreeId));
  } catch {
    // ignore
  }
}

export function listWorkspacePrefIds(storage?: StorageLike): string[] {
  const store = storage ?? resolveStorage();
  if (!store) return [];
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(KEY_PREFIX)) {
      out.push(k.slice(KEY_PREFIX.length));
    }
  }
  return out;
}

export interface WorkspacePrefsStore {
  readonly getPrefs: () => WorkspacePrefs;
  readonly setPref: (
    key: WorkspacePrefKey,
    value: WorkspacePrefs[WorkspacePrefKey],
  ) => void;
  readonly resetPrefs: () => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createWorkspacePrefsStore(
  worktreeId: string,
  storage?: StorageLike,
): WorkspacePrefsStore {
  const listeners = new Set<() => void>();
  let cachedPrefs: WorkspacePrefs = getWorkspacePrefs(worktreeId, storage);
  let dirty = false;

  function notify(): void {
    dirty = true;
    for (const l of listeners) l();
  }

  return {
    getPrefs(): WorkspacePrefs {
      if (dirty) {
        cachedPrefs = getWorkspacePrefs(worktreeId, storage);
        dirty = false;
      }
      return cachedPrefs;
    },
    setPref(key, value): void {
      setWorkspacePref(worktreeId, key, value, storage);
      notify();
    },
    resetPrefs(): void {
      deleteWorkspacePrefs(worktreeId, storage);
      notify();
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
