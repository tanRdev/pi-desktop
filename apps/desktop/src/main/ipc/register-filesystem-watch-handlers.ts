import { fsContracts, registerContractHandler } from "@pi-desktop/contracts";
import { PathGuardError, resolveInsideRoot } from "../fs/path-guards";
import type {
  FileWatchSender,
  WorkspaceFileWatcherService,
} from "../fs/workspace-file-watcher";

interface RegisterFilesystemWatchHandlersDependencies {
  handle: (
    channel: string,
    listener: (event?: unknown, payload?: unknown) => unknown,
  ) => void;
  getWorkspaceRootPath(): string | null;
  fileWatcher: WorkspaceFileWatcherService;
}

/**
 * Extract the event sender (`WebContents`) from an IPC event so watch
 * subscriptions can push `fs:changed` events back to the subscribing window.
 */
function extractWatchSender(event: unknown): FileWatchSender | null {
  if (typeof event !== "object" || event === null) {
    return null;
  }
  const sender = (event as { sender?: unknown }).sender;
  if (typeof sender !== "object" || sender === null) {
    return null;
  }
  if (typeof (sender as { send?: unknown }).send !== "function") {
    return null;
  }
  return sender as FileWatchSender;
}

function requireRoots(getWorkspaceRootPath: () => string | null): string[] {
  const root = getWorkspaceRootPath();
  if (!root) {
    throw new PathGuardError({
      code: "path/no-root-configured",
      message: "workspace root is not configured",
    });
  }
  return [root];
}

/**
 * Register the `fs:watch` / `fs:unwatch` contract handlers. Watching is a
 * subscription, not a request/response: the invoke records the sender
 * against the canonical workspace path in the watcher service, which then
 * pushes `fs:changed` contract events to that sender until `fs:unwatch`
 * (or sender destruction) tears the subscription down.
 */
export function registerFilesystemWatchHandlers({
  handle,
  getWorkspaceRootPath,
  fileWatcher,
}: RegisterFilesystemWatchHandlersDependencies): void {
  registerContractHandler({
    handle,
    contract: fsContracts.watch,
    handler: async ({ path: watchPath }, event) => {
      const sender = extractWatchSender(event);
      if (!sender) {
        throw new Error("fs.watch requires an IPC event sender");
      }
      const roots = requireRoots(getWorkspaceRootPath);
      const canonicalTarget = resolveInsideRoot(roots, watchPath);
      fileWatcher.subscribe(sender, canonicalTarget);
    },
  });

  registerContractHandler({
    handle,
    contract: fsContracts.unwatch,
    handler: async ({ path: watchPath }, event) => {
      const sender = extractWatchSender(event);
      if (!sender) {
        throw new Error("fs.unwatch requires an IPC event sender");
      }
      const roots = requireRoots(getWorkspaceRootPath);
      let canonicalTarget: string;
      try {
        canonicalTarget = resolveInsideRoot(roots, watchPath);
      } catch {
        // The watched root may have been deleted since subscribing; fall
        // back to the lexical absolute path so teardown still matches the
        // subscription key when possible, and never fail an unsubscribe.
        const pathModule = await import("node:path");
        canonicalTarget = pathModule.resolve(watchPath);
      }
      fileWatcher.unsubscribe(sender, canonicalTarget);
    },
  });
}
