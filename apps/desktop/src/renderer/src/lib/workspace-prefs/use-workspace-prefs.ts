import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { StorageLike } from "@/features/snapshots/snapshot-store";
import {
  createWorkspacePrefsStore,
  DEFAULT_WORKSPACE_PREFS,
  type WorkspacePrefKey,
  type WorkspacePrefs,
  type WorkspacePrefsStore,
} from "./workspace-prefs";

export interface UseWorkspacePrefsResult {
  prefs: WorkspacePrefs;
  setPref: (
    key: WorkspacePrefKey,
    value: WorkspacePrefs[WorkspacePrefKey],
  ) => void;
  resetPrefs: () => void;
}

export interface UseWorkspacePrefsOptions {
  worktreeId: string | null;
  storage?: StorageLike;
}

export function useWorkspacePrefs(
  options: UseWorkspacePrefsOptions,
): UseWorkspacePrefsResult {
  const worktreeId = options.worktreeId;
  const storage = options.storage;

  const store: WorkspacePrefsStore | null = useMemo(() => {
    if (!worktreeId) return null;
    return createWorkspacePrefsStore(worktreeId, storage);
  }, [worktreeId, storage]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!store) return () => {};
      return store.subscribe(onStoreChange);
    },
    [store],
  );

  const getSnapshot = useCallback(() => {
    if (!store) return DEFAULT_WORKSPACE_PREFS;
    return store.getPrefs();
  }, [store]);

  const getServerSnapshot = useCallback(() => {
    return DEFAULT_WORKSPACE_PREFS;
  }, []);

  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPref = useCallback(
    (key: WorkspacePrefKey, value: WorkspacePrefs[WorkspacePrefKey]) => {
      store?.setPref(key, value);
    },
    [store],
  );

  const resetPrefs = useCallback(() => {
    store?.resetPrefs();
  }, [store]);

  return { prefs, setPref, resetPrefs };
}
