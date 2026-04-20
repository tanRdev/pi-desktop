import { IPC_CHANNELS } from "@pi-desktop/shared";
import type { BrowserWindow } from "electron";

interface SessionLike {
  status: string;
  lastActivityAt?: number | undefined;
}

interface PtyLike {
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: { exitCode: number }) => void): void;
}

interface StreamLike {
  on(event: "data", listener: (chunk: unknown) => void): void;
}

interface ChildProcessLike {
  stdout: StreamLike;
  stderr: StreamLike;
  on(event: "exit", listener: (code: number | null) => void): void;
}

interface MainWindowLike {
  webContents: Pick<Electron.WebContents, "send">;
}

interface BindPtySessionEventsOptions {
  pty: PtyLike;
  session: SessionLike;
  id: string;
  mainWindow: BrowserWindow | MainWindowLike | null;
  onExit(exitCode: number): void;
  /**
   * Optional per-session scrollback byte cap. When the cumulative bytes
   * emitted by the pty exceed this value, subsequent data events are
   * silently dropped (not forwarded to the renderer). The goal is to
   * prevent a runaway process from consuming unbounded memory via the
   * IPC queue; xterm.js in the renderer has its own `scrollback` cap.
   * A value <= 0 disables the cap.
   */
  scrollbackByteCap?: number;
  onScrollbackCapReached?: (bytesDropped: number) => void;
}

interface BindChildProcessSessionEventsOptions {
  child: ChildProcessLike;
  session: SessionLike;
  id: string;
  mainWindow: BrowserWindow | MainWindowLike | null;
  onExit(exitCode: number): void;
  scrollbackByteCap?: number;
  onScrollbackCapReached?: (bytesDropped: number) => void;
}

function emitTerminalEvent(
  mainWindow: BrowserWindow | MainWindowLike | null,
  payload: {
    type: "data" | "exit";
    id: string;
    data?: string;
    exitCode?: number;
  },
): void {
  mainWindow?.webContents.send(IPC_CHANNELS.terminal.event, payload);
}

export function bindPtySessionEvents({
  pty,
  session,
  id,
  mainWindow,
  onExit,
  scrollbackByteCap = 0,
  onScrollbackCapReached,
}: BindPtySessionEventsOptions): void {
  let bytesEmitted = 0;
  let capNotified = false;

  pty.onData((data: string) => {
    session.status = "ready";
    session.lastActivityAt = Date.now();

    if (scrollbackByteCap > 0) {
      // `length` on a string is UTF-16 code units; fine for a byte-ish cap.
      bytesEmitted += data.length;
      if (bytesEmitted > scrollbackByteCap) {
        if (!capNotified) {
          capNotified = true;
          onScrollbackCapReached?.(bytesEmitted);
        }
        return;
      }
    }

    emitTerminalEvent(mainWindow, {
      type: "data",
      id,
      data,
    });
  });

  pty.onExit(({ exitCode }: { exitCode: number }) => {
    session.status = "exited";
    emitTerminalEvent(mainWindow, {
      type: "exit",
      id,
      exitCode,
    });
    onExit(exitCode);
  });
}

export function bindChildProcessSessionEvents({
  child,
  session,
  id,
  mainWindow,
  onExit,
  scrollbackByteCap = 0,
  onScrollbackCapReached,
}: BindChildProcessSessionEventsOptions): void {
  let bytesEmitted = 0;
  let capNotified = false;

  const emitChunk = (data: string) => {
    if (scrollbackByteCap > 0) {
      bytesEmitted += data.length;
      if (bytesEmitted > scrollbackByteCap) {
        if (!capNotified) {
          capNotified = true;
          onScrollbackCapReached?.(bytesEmitted);
        }
        return;
      }
    }
    emitTerminalEvent(mainWindow, {
      type: "data",
      id,
      data,
    });
  };

  child.stdout.on("data", (chunk: unknown) => {
    const data = String(chunk);
    session.status = "ready";
    session.lastActivityAt = Date.now();
    emitChunk(data);
  });

  child.stderr.on("data", (chunk: unknown) => {
    const data = String(chunk);
    session.lastActivityAt = Date.now();
    emitChunk(data);
  });

  child.on("exit", (code: number | null) => {
    const exitCode = code ?? 0;
    session.status = "exited";
    emitTerminalEvent(mainWindow, {
      type: "exit",
      id,
      exitCode,
    });
    onExit(exitCode);
  });
}
