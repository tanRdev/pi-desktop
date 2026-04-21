export type UndoManager<T> = {
  readonly push: (state: T) => void;
  readonly undo: () => T | undefined;
  readonly redo: () => T | undefined;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
  readonly clear: () => void;
  readonly size: () => number;
  readonly subscribe: UndoManagerSubscribe;
  getSnapshot: () => number;
};

type UndoManagerSubscribe = (listener: () => void) => () => void;

export type UndoManagerOptions = {
  maxStackSize?: number;
};

export function createUndoManager<T>(
  options: UndoManagerOptions = {},
): UndoManager<T> {
  const maxStackSize = options.maxStackSize ?? 100;
  const undoStack: T[] = [];
  const redoStack: T[] = [];
  const listeners = new Set<() => void>();
  let version = 0;

  function notify(): void {
    version += 1;
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): number {
    return version;
  }

  function push(state: T): void {
    if (undoStack.length >= maxStackSize) {
      undoStack.shift();
    }
    undoStack.push(state);
    redoStack.length = 0;
    notify();
  }

  function undo(): T | undefined {
    const entry = undoStack.pop();
    if (entry === undefined) return undefined;
    redoStack.push(entry);
    notify();
    return entry;
  }

  function redo(): T | undefined {
    const entry = redoStack.pop();
    if (entry === undefined) return undefined;
    undoStack.push(entry);
    notify();
    return entry;
  }

  function canUndo(): boolean {
    return undoStack.length > 0;
  }

  function canRedo(): boolean {
    return redoStack.length > 0;
  }

  function clear(): void {
    undoStack.length = 0;
    redoStack.length = 0;
    notify();
  }

  function size(): number {
    return undoStack.length;
  }

  return {
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    size,
    subscribe,
    getSnapshot,
  };
}
