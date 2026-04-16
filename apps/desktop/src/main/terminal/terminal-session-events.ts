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
}

interface BindChildProcessSessionEventsOptions {
  child: ChildProcessLike;
  session: SessionLike;
  id: string;
  mainWindow: BrowserWindow | MainWindowLike | null;
  onExit(exitCode: number): void;
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
}: BindPtySessionEventsOptions): void {
  pty.onData((data: string) => {
    session.status = "ready";
    session.lastActivityAt = Date.now();
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
}: BindChildProcessSessionEventsOptions): void {
  child.stdout.on("data", (chunk: unknown) => {
    const data = String(chunk);
    session.status = "ready";
    session.lastActivityAt = Date.now();
    emitTerminalEvent(mainWindow, {
      type: "data",
      id,
      data,
    });
  });

  child.stderr.on("data", (chunk: unknown) => {
    const data = String(chunk);
    session.lastActivityAt = Date.now();
    emitTerminalEvent(mainWindow, {
      type: "data",
      id,
      data,
    });
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
