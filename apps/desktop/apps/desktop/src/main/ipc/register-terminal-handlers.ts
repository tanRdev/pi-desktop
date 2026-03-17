import { IPC_CHANNELS } from "@pidesk/shared";
import { terminalManager } from "../terminal-manager";
import {
  getNumberField,
  getStringField,
  parseTerminalCreateOptions,
} from "./payload-parsers";

export function registerTerminalHandlers({
  handle,
  mainWindow,
  terminalManager: terminalManagerOverride,
}: {
  handle: (
    channel: string,
    listener: (
      event?: unknown,
      payload?: unknown,
    ) => Promise<unknown> | unknown,
  ) => void;
  mainWindow: any;
  terminalManager?: typeof terminalManager;
}) {
  const tm = terminalManagerOverride ?? terminalManager;

  if (mainWindow) {
    tm.setMainWindow(mainWindow);
  }
  tm.initialize();

  handle(IPC_CHANNELS.terminal.create, async (_event, payload) => {
    const options = parseTerminalCreateOptions(payload);
    if (!options) {
      throw new Error("terminal.create payload must include id, cols, rows");
    }
    if (!tm.isAvailable()) {
      const error = tm.getError();
      throw new Error(error?.message || "Terminal is not available");
    }
    return tm.create(options.id ?? "", options);
  });

  handle(IPC_CHANNELS.terminal.getSessions, async () => tm.getSessions());

  handle(IPC_CHANNELS.terminal.write, async (_event, payload) => {
    const id = getStringField(payload, "id");
    const data = getStringField(payload, "data");
    if (!id || data === undefined) {
      throw new Error("terminal.write payload must include id and data");
    }
    tm.write(id, data);
  });

  handle(IPC_CHANNELS.terminal.resize, async (_event, payload) => {
    const id = getStringField(payload, "id");
    const cols = getNumberField(payload, "cols");
    const rows = getNumberField(payload, "rows");
    if (!id || typeof cols !== "number" || typeof rows !== "number") {
      throw new Error("terminal.resize payload must include id, cols, rows");
    }
    tm.resize(id, cols, rows);
  });

  handle(IPC_CHANNELS.terminal.destroy, async (_event, payload) => {
    const id = getStringField(payload, "id");
    if (!id) {
      throw new Error("terminal.destroy payload must include id");
    }
    tm.destroy(id);
  });
}

export default undefined;
