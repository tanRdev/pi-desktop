import type { FSWatcher } from "node:fs";
import {
  fsContracts,
  IPC_CHANNELS,
  registerContractHandler,
} from "@pi-desktop/contracts";
import type { FileChangeEventType } from "@pi-desktop/shared";
import { PathGuardError, resolveInsideRoot } from "../fs/path-guards";

interface RegisterFsWatchHandlersDependencies {
  handle: (
    channel: string,
    listener: (event?: unknown, payload?: unknown) => unknown,
  ) => void;
  getWorkspaceRootPath(): string | null;
}

/**
 * Minimal structural view of the IPC event's `sender` (a WebContents) so the
 * watcher can push `fs:event` payloads back to the subscribed renderer.
 */
interface FsEventSender {
  send(channel: string, payload: unknown): void;
  isDestroyed(): boolean;
}

function toFsEventSender(event: unknown): FsEventSender | null {
  if (typeof event !== "object" || event === null) return null;
  if (!("sender" in event)) return null;
  const { sender } = event;
  if (typeof sender !== "object" || sender === null) return null;
  if (!("send" in sender) || typeof sender.send !== "function") return null;
  if (!("isDestroyed" in sender) || typeof sender.isDestroyed !== "function") {
    return null;
  }
  const send = sender.send;
  const isDestroyed = sender.isDestroyed;
  return {
    send: (channel, payload) => {
      Reflect.apply(send, sender, [channel, payload]);
    },
    isDestroyed: () => Reflect.apply(isDestroyed, sender, []) === true,
  };
}

interface ActiveWatcher {
  watcher: FSWatcher;
  sender: FsEventSender;
  refs: number;
}

/**
 * Churn from VCS internals and dependencies should never refresh the tree.
 */
function shouldIgnoreWatchedPath(relativePath: string): boolean {
  return relativePath
    .split("/")
    .some((segment) => segment === "node_modules" || segment.startsWith("."));
}

function requireRoot(getWorkspaceRootPath: () => string | null): string {
  const root = getWorkspaceRootPath();
  if (!root) {
    throw new PathGuardError({
      code: "path/no-root-configured",
      message: "workspace root is not configured",
    });
  }
  return root;
}

export function registerFsWatchHandlers({
  handle,
  getWorkspaceRootPath,
}: RegisterFsWatchHandlersDependencies): void {
  const watchers = new Map<string, ActiveWatcher>();

  registerContractHandler({
    handle,
    contract: fsContracts.watch,
    handler: async ({ path: watchPath }, event) => {
      const canonicalTarget = resolveInsideRoot(
        [requireRoot(getWorkspaceRootPath)],
        watchPath,
      );

      const pathModule = await import("node:path");
      // Key the watcher by the caller-supplied path (resolved to absolute)
      // rather than the realpath-canonicalized target, so event payloads
      // round-trip with the renderer's own path strings. Canonical paths
      // (e.g. /tmp → /private/tmp on macOS) would never match otherwise.
      const watchKey = pathModule.isAbsolute(watchPath)
        ? pathModule.resolve(watchPath)
        : canonicalTarget;

      const existing = watchers.get(watchKey);
      if (existing) {
        existing.refs += 1;
        return;
      }

      const sender = toFsEventSender(event);
      if (!sender) {
        throw new Error("fs.watch requires a renderer event sender");
      }

      const fsModule = await import("node:fs");
      const watcher = fsModule.watch(
        watchKey,
        { recursive: true },
        (eventType, filename) => {
          if (typeof filename !== "string" || filename.length === 0) return;
          if (shouldIgnoreWatchedPath(filename)) return;

          if (sender.isDestroyed()) {
            watchers.get(watchKey)?.watcher.close();
            watchers.delete(watchKey);
            return;
          }

          const changedPath = pathModule.join(watchKey, filename);
          const type: FileChangeEventType =
            eventType === "change"
              ? "modify"
              : fsModule.existsSync(changedPath)
                ? "create"
                : "delete";
          sender.send(IPC_CHANNELS.fs.event, {
            watchPath: watchKey,
            type,
            path: changedPath,
            timestamp: Date.now(),
          });
        },
      );
      watcher.on("error", (error) => {
        console.error(`[fs.watch] watcher error for ${watchKey}:`, error);
      });
      watchers.set(watchKey, { watcher, sender, refs: 1 });
    },
  });

  registerContractHandler({
    handle,
    contract: fsContracts.unwatch,
    handler: async ({ path: watchPath }) => {
      const pathModule = await import("node:path");
      const watchKey = pathModule.isAbsolute(watchPath)
        ? pathModule.resolve(watchPath)
        : watchPath;
      const existing = watchers.get(watchKey);
      if (!existing) return;
      existing.refs -= 1;
      if (existing.refs > 0) return;
      existing.watcher.close();
      watchers.delete(watchKey);
    },
  });
}
