import type { FileEntry } from "@pi-desktop/shared/models/fs";
import type {
  FileChangeEvent,
  FileChangeEventType,
} from "./file-watcher-stream";

export interface FileWatcherBridge {
  start: (
    workspacePath: string,
    onEvent: (event: FileChangeEvent) => void,
  ) => void;
  stop: () => void;
  isActive: () => boolean;
}

export interface FileWatcherBridgeOptions {
  now?: () => number;
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 5000;

interface SnapshotEntry {
  path: string;
  mtimeMs: number;
  type: "file" | "directory";
}

function collectPaths(entries: FileEntry[]): Map<string, SnapshotEntry> {
  const map = new Map<string, SnapshotEntry>();
  for (const entry of entries) {
    map.set(entry.path, {
      path: entry.path,
      mtimeMs: 0,
      type: entry.type,
    });
  }
  return map;
}

export function createFileWatcherBridge(
  options: FileWatcherBridgeOptions = {},
): FileWatcherBridge {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let onEvent: ((event: FileChangeEvent) => void) | null = null;
  let workspacePath: string | null = null;
  let previous: Map<string, SnapshotEntry> | null = null;
  let active = false;

  async function poll(): Promise<void> {
    if (!active || !workspacePath || !onEvent) return;

    let listing: { entries: FileEntry[] };
    try {
      listing = await window.piDesktop.fs.readDirectory(workspacePath);
    } catch {
      return;
    }

    const current = collectPaths(listing.entries);

    if (previous) {
      for (const [path, entry] of current) {
        const prev = previous.get(path);
        if (!prev) {
          emit("create", path);
        } else if (entry.mtimeMs !== prev.mtimeMs) {
          emit("modify", path);
        }
      }

      for (const [path] of previous) {
        if (!current.has(path)) {
          emit("delete", path);
        }
      }
    }

    previous = current;
  }

  function emit(type: FileChangeEventType, path: string): void {
    if (!onEvent) return;
    onEvent({ type, path, timestamp: now() });
  }

  return {
    start(path: string, callback: (event: FileChangeEvent) => void): void {
      if (active) this.stop();
      workspacePath = path;
      onEvent = callback;
      active = true;
      previous = null;
      void poll();
      intervalId = setInterval(() => void poll(), pollIntervalMs);
    },
    stop(): void {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      active = false;
      workspacePath = null;
      onEvent = null;
      previous = null;
    },
    isActive: () => active,
  };
}

export function isNativeWatchAvailable(): boolean {
  // TODO: add `watch` to shared fs type once the IPC channel is implemented
  const desc = Object.getOwnPropertyDescriptor(window.piDesktop.fs, "watch");
  return typeof desc?.value === "function";
}
