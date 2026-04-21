import type { WorkspaceSession } from "@pi-desktop/shared";
import type {
  SnapshotRestoreResult,
  SnapshotStore,
  WorkspaceSnapshotMeta,
  WorkspaceSnapshotRecord,
} from "./snapshot-store";

/**
 * High-level facade around `SnapshotStore` providing user-facing actions:
 * list / restore / delete / export. Restoration is delegated back to the
 * caller (typically the workspace session store) via `applyRestoredSession`.
 */
export interface SnapshotApiOptions {
  store: SnapshotStore;
  /** Apply a restored, migrated session to the live workspace. */
  applyRestoredSession: (session: WorkspaceSession) => void;
  /**
   * File-saver hook. Defaults to triggering a browser download via
   * `URL.createObjectURL` + a synthetic anchor click. Override in tests.
   */
  download?: (filename: string, blob: Blob) => void;
}

export interface SnapshotApi {
  list(): WorkspaceSnapshotMeta[];
  get(ts: number): WorkspaceSnapshotRecord | null;
  create(label?: string): WorkspaceSnapshotMeta | null;
  restore(ts: number): SnapshotRestoreResult;
  delete(ts: number): boolean;
  /** Serialize a snapshot record and trigger a `.json` download. */
  exportSnapshot(ts: number): boolean;
}

function defaultDownload(filename: string, blob: Blob): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  // Avoid attaching to the live DOM tree to prevent layout side effects;
  // some browsers (Safari < 15) require attachment, but modern Chromium
  // (Electron) handles detached anchors correctly.
  anchor.click();
  // Defer revocation to give the browser time to start the download.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function createSnapshotApi(options: SnapshotApiOptions): SnapshotApi {
  const store = options.store;
  const download = options.download ?? defaultDownload;
  const applyRestoredSession = options.applyRestoredSession;

  return {
    list() {
      return store.list();
    },
    get(ts) {
      return store.get(ts);
    },
    create(label) {
      return store.create(label);
    },
    restore(ts) {
      const result = store.restore(ts);
      if (result.kind === "ok" || result.kind === "migrated") {
        applyRestoredSession(result.session);
      }
      return result;
    },
    delete(ts) {
      return store.delete(ts);
    },
    exportSnapshot(ts) {
      const record = store.get(ts);
      if (record === null) return false;
      const blob = new Blob([JSON.stringify(record, null, 2)], {
        type: "application/json",
      });
      const filename = `workspace-snapshot-${record.session.worktreeId}-${record.ts}.json`;
      download(filename, blob);
      return true;
    },
  };
}
