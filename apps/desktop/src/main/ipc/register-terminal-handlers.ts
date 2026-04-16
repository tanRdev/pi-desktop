import { IPC_CHANNELS } from "@pi-desktop/shared";
import type { BrowserWindow } from "electron";
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
}

export function registerTerminalHandlers({
  handle,
  mainWindow,
  terminalManager,
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

    return terminalManager.create(options.id ?? "", options);
  });

  handle(IPC_CHANNELS.terminal.getSessions, async () =>
    terminalManager.getSessions(),
  );

  handle(IPC_CHANNELS.terminal.write, async (_event, payload) => {
    const id = getStringField(payload, "id");
    const data = getStringField(payload, "data");
    if (!id || data === undefined) {
      throw new Error("terminal.write payload must include id and data");
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

  handle(IPC_CHANNELS.terminal.resize, async (_event, payload) => {
    const id = getStringField(payload, "id");
    const cols = getNumberField(payload, "cols");
    const rows = getNumberField(payload, "rows");
    if (!id || typeof cols !== "number" || typeof rows !== "number") {
      throw new Error("terminal.resize payload must include id, cols, rows");
    }

    terminalManager.resize(id, cols, rows);
  });

  handle(IPC_CHANNELS.terminal.destroy, async (_event, payload) => {
    const id = getStringField(payload, "id");
    if (!id) {
      throw new Error("terminal.destroy payload must include id");
    }

    terminalManager.destroy(id);
  });
}
