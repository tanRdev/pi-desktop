import {
  registerContractHandler,
  terminalContracts,
} from "@pi-desktop/contracts";
import type { BrowserWindow } from "electron";
import { resolveInsideRoot } from "../fs/path-guards";
import type { IpcRegistrar } from "../ipc-router";

type TerminalManagerLike = typeof import("../terminal-manager").terminalManager;

interface RegisterTerminalHandlersDependencies {
  handle: IpcRegistrar["handle"];
  mainWindow: BrowserWindow | null;
  terminalManager: TerminalManagerLike;
  /**
   * Returns the set of directories that terminal sessions are allowed to
   * spawn inside (repository roots plus their active worktrees). Any
   * `cwd` requested via `terminal.create` must resolve within one of
   * these directories or the call is rejected.
   */
  getAllowedTerminalCwds: () => readonly string[];
}

/**
 * Extract the WebContents id from an Electron IPC event. Real events expose
 * `event.sender.id` (number). In unit tests, the event may be a plain object
 * with an arbitrary `sender` field; in that case we fall back to a stable
 * string key so ownership checks can still compare equal for the same
 * synthetic caller.
 */
function extractSenderKey(event: unknown): number | string {
  if (typeof event !== "object" || event === null) {
    return "__no_sender__";
  }
  const sender = (event as { sender?: unknown }).sender;
  if (typeof sender === "object" && sender !== null) {
    const id = (sender as { id?: unknown }).id;
    if (typeof id === "number") return id;
  }
  if (typeof sender === "string") return sender;
  return "__no_sender__";
}

export function registerTerminalHandlers({
  handle,
  mainWindow,
  terminalManager,
  getAllowedTerminalCwds,
}: RegisterTerminalHandlersDependencies): void {
  if (mainWindow) {
    terminalManager.setMainWindow(mainWindow);
  }
  terminalManager.initialize();

  registerContractHandler({
    handle,
    contract: terminalContracts.create,
    handler: async (options, event) => {
      if (!terminalManager.isAvailable()) {
        const error = terminalManager.getError();
        throw new Error(error?.message || "Terminal is not available");
      }

      const allowedCwds = getAllowedTerminalCwds();
      const authorizedCwd = resolveInsideRoot(allowedCwds, options.cwd);

      return terminalManager.create(
        options.id,
        {
          ...options,
          cwd: authorizedCwd,
        },
        extractSenderKey(event),
      );
    },
  });

  registerContractHandler({
    handle,
    contract: terminalContracts.getSessions,
    handler: async () => terminalManager.getSessions(),
  });

  registerContractHandler({
    handle,
    contract: terminalContracts.write,
    handler: async ({ id, data }, event) => {
      if (!terminalManager.isOwnedBy(id, extractSenderKey(event))) {
        throw new Error(
          `terminal.write rejected: caller does not own terminal ${id}`,
        );
      }

      terminalManager.write(id, data);
    },
  });

  registerContractHandler({
    handle,
    contract: terminalContracts.resize,
    handler: async ({ id, cols, rows }, event) => {
      if (!terminalManager.isOwnedBy(id, extractSenderKey(event))) {
        throw new Error(
          `terminal.resize rejected: caller does not own terminal ${id}`,
        );
      }

      terminalManager.resize(id, cols, rows);
    },
  });

  registerContractHandler({
    handle,
    contract: terminalContracts.destroy,
    handler: async ({ id }, event) => {
      // React StrictMode can clean up an initialization attempt before the
      // matching backend session exists. Destroy is intentionally idempotent.
      if (!terminalManager.hasSession(id)) {
        return;
      }

      if (!terminalManager.isOwnedBy(id, extractSenderKey(event))) {
        throw new Error(
          `terminal.destroy rejected: caller does not own terminal ${id}`,
        );
      }

      terminalManager.destroy(id);
    },
  });
}

/**
 * Push channel: `terminalContracts.event` (`terminal:event`).
 * Main emits via `terminal-session-events.ts`; preload should subscribe with
 * `createContractSubscriber(on)(terminalContracts.event, listener)`.
 * Wire-notes: `.scratch/turbocharge/wire-notes-fs-terminal.md`
 */
export { terminalContracts };
