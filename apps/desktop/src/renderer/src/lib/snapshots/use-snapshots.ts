import { useCallback, useEffect, useState } from "react";
import type { SnapshotApi } from "./snapshot-api";
import type {
  SnapshotRestoreResult,
  WorkspaceSnapshotMeta,
} from "./snapshot-store";

export interface UseSnapshotsResult {
  snapshots: ReadonlyArray<WorkspaceSnapshotMeta>;
  refresh: () => void;
  create: (label?: string) => WorkspaceSnapshotMeta | null;
  restore: (ts: number) => SnapshotRestoreResult;
  remove: (ts: number) => boolean;
  exportSnapshot: (ts: number) => boolean;
}

/**
 * React hook around `SnapshotApi`. The underlying store does not currently
 * support subscribers, so list refreshes happen on demand (after every
 * mutation) and via an optional `pollMs` timer.
 */
export function useSnapshots(
  api: SnapshotApi,
  options?: { pollMs?: number },
): UseSnapshotsResult {
  const [snapshots, setSnapshots] = useState<
    ReadonlyArray<WorkspaceSnapshotMeta>
  >(() => api.list());

  const refresh = useCallback(() => {
    setSnapshots(api.list());
  }, [api]);

  useEffect(() => {
    refresh();
    const pollMs = options?.pollMs;
    if (typeof pollMs !== "number" || pollMs <= 0) {
      return undefined;
    }
    const handle = setInterval(refresh, pollMs);
    return () => clearInterval(handle);
  }, [refresh, options?.pollMs]);

  const create = useCallback(
    (label?: string) => {
      const meta = api.create(label);
      refresh();
      return meta;
    },
    [api, refresh],
  );

  const restore = useCallback(
    (ts: number) => {
      const result = api.restore(ts);
      refresh();
      return result;
    },
    [api, refresh],
  );

  const remove = useCallback(
    (ts: number) => {
      const ok = api.delete(ts);
      refresh();
      return ok;
    },
    [api, refresh],
  );

  const exportSnapshot = useCallback(
    (ts: number) => api.exportSnapshot(ts),
    [api],
  );

  return { snapshots, refresh, create, restore, remove, exportSnapshot };
}
