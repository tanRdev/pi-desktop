import { IPC_CHANNELS } from "@pi-desktop/shared";
import type { BrowserWindow } from "electron";
import { resolveInsideRoot } from "../fs/path-guards";
import type { IpcRegistrar } from "../ipc-router";
import {
  getNumberField,
  getStringField,
  parseTerminalCreateOptions,
} from "./payload-parsers";

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

  handle(IPC_CHANNELS.terminal.create, async (_event, payload) => {
    const options = parseTerminalCreateOptions(payload);
    if (!options) {
      throw new Error(
        "terminal.create payload must include id, cols, rows, and ownerWindowId",
      );
    }
    if (!terminalManager.isAvailable()) {
      const error = terminalManager.getError();
      throw new Error(error?.message || "Terminal is not available");
    }

    const requestedCwd = options.cwd;
    if (!requestedCwd || typeof requestedCwd !== "string") {
      throw new Error(
        "terminal.create payload must include cwd (an allowed repository or worktree path)",
      );
    }

    const allowedCwds = getAllowedTerminalCwds();

    const authorizedCwd = resolveInsideRoot(allowedCwds, requestedCwd);

    return terminalManager.create(
      options.id ?? "",
      {
        ...options,
        cwd: authorizedCwd,
      },
      extractSenderKey(_event),
    );
  });

  handle(IPC_CHANNELS.terminal.getSessions, async () =>
    terminalManager.getSessions(),
  );

  handle(IPC_CHANNELS.terminal.write, async (event, payload) => {
    const id = getStringField(payload, "id");
    const data = getStringField(payload, "data");
    if (!id || data === undefined) {
      throw new Error("terminal.write payload must include id and data");
    }
    if (!terminalManager.isOwnedBy(id, extractSenderKey(event))) {
      throw new Error(
        `terminal.write rejected: caller does not own terminal ${id}`,
      );
    }

    const maxTerminalWriteSize = 64 * 1024;
    if (
      data.length > maxTerminalWriteSize ||
      Buffer.byteLength(data, "utf-8") > maxTerminalWriteSize
    ) {
      throw new Error(
        `terminal.write data exceeds maximum size of ${maxTerminalWriteSize} bytes`,
      );
    }

    terminalManager.write(id, data);
  });

  handle(IPC_CHANNELS.terminal.resize, async (event, payload) => {
    const id = getStringField(payload, "id");
    const cols = getNumberField(payload, "cols");
    const rows = getNumberField(payload, "rows");
    if (!id || typeof cols !== "number" || typeof rows !== "number") {
      throw new Error("terminal.resize payload must include id, cols, rows");
    }
    if (!terminalManager.isOwnedBy(id, extractSenderKey(event))) {
      throw new Error(
        `terminal.resize rejected: caller does not own terminal ${id}`,
      );
    }

    terminalManager.resize(id, cols, rows);
  });

  handle(IPC_CHANNELS.terminal.destroy, async (event, payload) => {
    const id = getStringField(payload, "id");
    if (!id) {
      throw new Error("terminal.destroy payload must include id");
    }
    if (!terminalManager.isOwnedBy(id, extractSenderKey(event))) {
      throw new Error(
        `terminal.destroy rejected: caller does not own terminal ${id}`,
      );
    }

    terminalManager.destroy(id);
  });
}
