import type {
  FileChangeEvent,
  FileChangeEventType,
} from "@pi-desktop/shared/models/fs";

export type { FileChangeEvent, FileChangeEventType };

export type FileChangeSubscriber = (event: FileChangeEvent) => void;

export interface FileWatcherStream {
  subscribe: (subscriber: FileChangeSubscriber) => () => void;
  getActivePath: () => string | null;
  isActive: () => boolean;
}

export type FsWatchFn = (
  path: string,
  onEvent: (event: FileChangeEvent) => void,
) => (() => void) | undefined;

export interface FileWatcherStreamOptions {
  now?: () => number;
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 100;

function invokeNativeWatch(
  workspacePath: string,
  onEvent: (event: FileChangeEvent) => void,
): (() => void) | null {
  // Runtime guard: tests may install partial window.piDesktop mocks.
  const watchFn = window.piDesktop.fs.watch;
  if (typeof watchFn !== "function") {
    return null;
  }
  const result = watchFn(workspacePath, onEvent);
  return typeof result === "function" ? result : null;
}

export function watch(
  workspacePath: string,
  options: FileWatcherStreamOptions = {},
): FileWatcherStream {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const now = options.now ?? (() => Date.now());

  const subscribers = new Set<FileChangeSubscriber>();
  const pending = new Map<
    string,
    { type: FileChangeEventType; timer: ReturnType<typeof setTimeout> }
  >();
  let unsubscribeFn: (() => void) | null = null;
  let active = true;

  function emit(event: FileChangeEvent): void {
    for (const sub of subscribers) sub(event);
  }

  function flush(path: string, type: FileChangeEventType): void {
    const event: FileChangeEvent = { type, path, timestamp: now() };
    emit(event);
  }

  function onRawEvent(raw: FileChangeEvent): void {
    const existing = pending.get(raw.path);
    if (existing) {
      clearTimeout(existing.timer);
    }

    let resolvedType = raw.type;
    if (existing) {
      if (existing.type === "create" && raw.type === "delete") {
        resolvedType = "create";
      } else if (existing.type === "delete" && raw.type === "create") {
        resolvedType = "modify";
      } else if (existing.type === "rename" || raw.type === "rename") {
        resolvedType = "rename";
      } else if (existing.type === "create" && raw.type === "modify") {
        resolvedType = "create";
      } else if (existing.type === "modify" && raw.type === "delete") {
        resolvedType = "delete";
      } else {
        resolvedType = raw.type;
      }
    }

    const timer = setTimeout(() => {
      pending.delete(raw.path);
      flush(raw.path, resolvedType);
    }, debounceMs);

    pending.set(raw.path, { type: resolvedType, timer });
  }

  const maybeUnsubscribe = invokeNativeWatch(workspacePath, onRawEvent);
  if (maybeUnsubscribe !== null) {
    unsubscribeFn = maybeUnsubscribe;
  }

  function destroy(): void {
    if (!active) return;
    active = false;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
    }
    pending.clear();
    unsubscribeFn?.();
    unsubscribeFn = null;
    subscribers.clear();
  }

  return {
    subscribe(subscriber: FileChangeSubscriber): () => void {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
        if (subscribers.size === 0) {
          destroy();
        }
      };
    },
    getActivePath: () => (active ? workspacePath : null),
    isActive: () => active,
  };
}
