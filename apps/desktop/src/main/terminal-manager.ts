import type { BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { IPC_CHANNELS } from "@pidesk/shared";

const require = createRequire(import.meta.url);

export interface TerminalInstance {
  id: string;
  pty: unknown;
  cwd: string;
}

class TerminalManager {
  private terminals: Map<string, TerminalInstance> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private ptyModule: typeof import("node-pty") | null = null;
  private initError: Error | null = null;

  initialize(): void {
    try {
      // Use require for native modules with electron-vite
      this.ptyModule = require("node-pty");
    } catch (error) {
      this.initError = error instanceof Error ? error : new Error("Failed to load node-pty");
      console.error("Failed to load node-pty:", this.initError.message);
    }
  }

  isAvailable(): boolean {
    return this.ptyModule !== null;
  }

  getError(): Error | null {
    return this.initError;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  create(id: string, options: { cols: number; rows: number; cwd?: string }): TerminalInstance | null {
    if (!this.ptyModule) {
      throw new Error("node-pty is not available. Terminal functionality is disabled.");
    }

    const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/zsh";
    const cwd = options.cwd || process.cwd();

    const pty = this.ptyModule.spawn(shell, [], {
      name: "xterm-256color",
      cols: options.cols,
      rows: options.rows,
      cwd,
      env: process.env as Record<string, string>,
    });

    const instance: TerminalInstance = { id, pty, cwd };

    pty.onData((data: string) => {
      this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
        type: "data",
        id,
        data,
      });
    });

    pty.onExit(({ exitCode }: { exitCode: number }) => {
      this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
        type: "exit",
        id,
        exitCode,
      });
      this.terminals.delete(id);
    });

    this.terminals.set(id, instance);
    return instance;
  }

  write(id: string, data: string): void {
    const instance = this.terminals.get(id);
    if (instance && instance.pty) {
      (instance.pty as import("node-pty").IPty).write(data);
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const instance = this.terminals.get(id);
    if (instance && instance.pty) {
      (instance.pty as import("node-pty").IPty).resize(cols, rows);
    }
  }

  destroy(id: string): void {
    const instance = this.terminals.get(id);
    if (instance && instance.pty) {
      (instance.pty as import("node-pty").IPty).kill();
      this.terminals.delete(id);
    }
  }

  destroyAll(): void {
    for (const id of this.terminals.keys()) {
      this.destroy(id);
    }
  }

  get(id: string): TerminalInstance | undefined {
    return this.terminals.get(id);
  }
}

export const terminalManager = new TerminalManager();