import { useCallback, useSyncExternalStore } from "react";
import type { UndoManager } from "./undo-manager";

export type UseUndoManagerResult = {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undo: () => void;
  readonly redo: () => void;
};

export function useUndoManager<T>(
  manager: UndoManager<T>,
): UseUndoManagerResult {
  const version = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );

  void version;

  const undo = useCallback(() => {
    manager.undo();
  }, [manager]);

  const redo = useCallback(() => {
    manager.redo();
  }, [manager]);

  return {
    canUndo: manager.canUndo(),
    canRedo: manager.canRedo(),
    undo,
    redo,
  };
}
