import { existsSync, type FSWatcher, watch as fsWatch } from "node:fs";
import path from "node:path";
import { type FileChangeEvent, IPC_CHANNELS } from "@pi-desktop/shared";

/**
 * Workspace filesystem watcher (main process).
 *
 * Watches a workspace root recursively with `node:fs.watch` and pushes
 * classified change events to each subscribed renderer over the typed
 * `fs:changed` event contract (`fsContracts.changed`). Subscriptions are
 * keyed by the IPC sender (a `WebContents`-shaped object), so a window only
 * receives events for roots it asked to watch, and its watches are torn down
 * when the sender is destroyed.
 *
 * Directory basenames in {@link IGNORED_DIRECTORY_NAMES} are never reported:
 * they churn constantly (dependency installs, VCS internals) and are not
 * shown in the file tree.
 */

export interface FileWatchSender {
  send(channel: string, payload: FileChangeEvent): void;
  once?(event: "destroyed", listener: () => void): void;
  isDestroyed?(): boolean;
}

type RawWatchEventType = "rename" | "change";

export interface WatchDirectoryHandle {
  close(): void;
}

export type WatchDirectoryFn = (
  rootPath: string,
  listener: (eventType: RawWatchEventType, filename: string | null) => void,
) => WatchDirectoryHandle;

export interface WorkspaceFileWatcherService {
  subscribe(sender: FileWatchSender, rootPath: string): void;
  unsubscribe(sender: FileWatchSender, rootPath: string): void;
  unsubscribeAll(sender: FileWatchSender): void;
  /** Number of live watchers held for a sender (test/diagnostic hook). */
  watcherCountFor(sender: FileWatchSender): number;
}

const IGNORED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
]);

interface WatchEntry {
  readonly rootPath: string;
  readonly handle: WatchDirectoryHandle;
  readonly senders: Set<FileWatchSender>;
}

function defaultWatchDirectory(
  rootPath: string,
  listener: (eventType: RawWatchEventType, filename: string | null) => void,
): WatchDirectoryHandle {
  const watcher: FSWatcher = fsWatch(
    rootPath,
    { recursive: true },
    (eventType, filename) => {
      listener(
        eventType === "change" ? "change" : "rename",
        filename === null ? null : String(filename),
      );
    },
  );
  // A watcher error (e.g. the root was deleted) must not crash the main
  // process; the subscription simply stops producing events.
  watcher.on("error", () => undefined);
  return watcher;
}

function isIgnoredPath(rootPath: string, changedPath: string): boolean {
  const relative = path.relative(rootPath, changedPath);
  if (relative === "") return false;
  return relative
    .split(path.sep)
    .some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
}

/**
 * Classify a raw `fs.watch` callback into the contract event type.
 * `rename` means an entry appeared, disappeared, or moved; existence on disk
 * at delivery time decides between create / delete / rename.
 */
function classifyEvent(
  eventType: RawWatchEventType,
  changedPath: string,
): FileChangeEvent["type"] {
  if (eventType === "change") {
    return "modify";
  }
  return existsSync(changedPath) ? "create" : "delete";
}

export function createWorkspaceFileWatcherService(
  watchDirectory: WatchDirectoryFn = defaultWatchDirectory,
  now: () => number = () => Date.now(),
): WorkspaceFileWatcherService {
  /** Live watchers keyed by canonical root path. */
  const entriesByRoot = new Map<string, WatchEntry>();
  /** Senders already hooked for `destroyed` cleanup. */
  const hookedSenders = new WeakSet<FileWatchSender>();

  function teardownEntry(entry: WatchEntry): void {
    entriesByRoot.delete(entry.rootPath);
    try {
      entry.handle.close();
    } catch {
      // Closing an already-dead watcher is harmless.
    }
  }

  function removeSender(entry: WatchEntry, sender: FileWatchSender): void {
    entry.senders.delete(sender);
    if (entry.senders.size === 0) {
      teardownEntry(entry);
    }
  }

  function handleRawEvent(
    entry: WatchEntry,
    eventType: RawWatchEventType,
    filename: string | null,
  ): void {
    // Without a filename we cannot attribute the change to a path; the
    // renderer debounces per path, so unattributed events are dropped.
    if (!filename) return;
    const changedPath = path.join(entry.rootPath, filename);
    if (isIgnoredPath(entry.rootPath, changedPath)) return;

    const event: FileChangeEvent = {
      type: classifyEvent(eventType, changedPath),
      path: changedPath,
      timestamp: now(),
    };

    for (const sender of [...entry.senders]) {
      if (sender.isDestroyed?.()) {
        removeSender(entry, sender);
        continue;
      }
      try {
        sender.send(IPC_CHANNELS.fs.changed, event);
      } catch {
        removeSender(entry, sender);
      }
    }
  }

  function subscribe(sender: FileWatchSender, rootPath: string): void {
    if (!hookedSenders.has(sender) && typeof sender.once === "function") {
      hookedSenders.add(sender);
      sender.once("destroyed", () => {
        unsubscribeAll(sender);
      });
    }

    const existing = entriesByRoot.get(rootPath);
    if (existing) {
      existing.senders.add(sender);
      return;
    }

    const entry: WatchEntry = {
      rootPath,
      senders: new Set([sender]),
      handle: watchDirectory(rootPath, (eventType, filename) => {
        handleRawEvent(entry, eventType, filename);
      }),
    };
    entriesByRoot.set(rootPath, entry);
  }

  function unsubscribe(sender: FileWatchSender, rootPath: string): void {
    const entry = entriesByRoot.get(rootPath);
    if (!entry) return;
    removeSender(entry, sender);
  }

  function unsubscribeAll(sender: FileWatchSender): void {
    for (const entry of [...entriesByRoot.values()]) {
      removeSender(entry, sender);
    }
  }

  return {
    subscribe,
    unsubscribe,
    unsubscribeAll,
    watcherCountFor(sender: FileWatchSender): number {
      let count = 0;
      for (const entry of entriesByRoot.values()) {
        if (entry.senders.has(sender)) count += 1;
      }
      return count;
    },
  };
}
