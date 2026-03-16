import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import type {
  TerminalBackend,
  TerminalCreateOptions,
  TerminalSession,
} from "@pidesk/shared";
import { IPC_CHANNELS } from "@pidesk/shared";
import type { BrowserWindow } from "electron";
import { createTmuxThreadSessionName } from "./tmux-session-naming";

const nodeRequire = createRequire(import.meta.url);

type PtyModule = typeof import("node-pty");

interface TerminalInstance {
  session: TerminalSession;
  // node-pty IPty when used to attach to tmux or spawn a local shell
  pty?: import("node-pty").IPty | null;
  // fallback child process when node-pty is not available
  childProcess?: ReturnType<typeof spawn> | null;
  // tmux session name if backed by tmux
  tmuxSessionName?: string | null;
}

function sanitizeSessionName(id: string): string {
  const sanitized = id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `pidesk-term-${sanitized}`.slice(0, 48);
}

class TerminalManager {
  private terminals: Map<string, TerminalInstance> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private ptyModule: PtyModule | null = null;
  private initError: Error | null = null;
  private tmuxBinary = "tmux";

  initialize(): void {
    try {
      // Use require for native modules with electron-vite
      this.ptyModule = nodeRequire("node-pty");
    } catch (error) {
      this.initError =
        error instanceof Error ? error : new Error("Failed to load node-pty");
      console.error("Failed to load node-pty:", this.initError.message);
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  isAvailable(): boolean {
    // Terminal capability is available if either node-pty loaded OR tmux exists
    return this.ptyModule !== null || this.hasTmux();
  }

  getError(): Error | null {
    return this.initError;
  }

  private hasTmux(): boolean {
    try {
      const result = spawnSync(this.tmuxBinary, ["-V"], { encoding: "utf8" });
      return result.status === 0 && result.error == null;
    } catch {
      return false;
    }
  }

  private runTmux(args: string[], cwd?: string) {
    try {
      const result = spawnSync(this.tmuxBinary, args, {
        cwd,
        encoding: "utf8",
      });
      return {
        status: result.status ?? 1,
        stdout: String(result.stdout ?? ""),
        stderr: String(result.stderr ?? ""),
        error: result.error ?? null,
      };
    } catch (error: unknown) {
      return {
        status: 1,
        stdout: "",
        stderr: "",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  create(id: string, opts: TerminalCreateOptions): TerminalSession {
    const cols = opts.cols;
    const rows = opts.rows;
    const backend: TerminalBackend =
      (opts.backend as TerminalBackend) ?? "shell";
    if (!id || typeof cols !== "number" || typeof rows !== "number") {
      throw new Error("terminal.create payload must include id, cols, rows");
    }
    if (!opts.ownerWindowId || typeof opts.ownerWindowId !== "string") {
      throw new Error("terminal.create payload must include ownerWindowId");
    }

    const cwd = opts.cwd ?? process.cwd();
    const createdAt = Date.now();

    const session: TerminalSession = {
      id,
      backend,
      cwd,
      status: "starting",
      ownerWindowId: opts.ownerWindowId,
      createdAt,
    };

    const instance: TerminalInstance = {
      session,
      pty: null,
      childProcess: null,
      tmuxSessionName: null,
    };

    const supportsTmux = this.hasTmux();
    const tmuxBackends = new Set<TerminalBackend>([
      "shell",
      "lazygit",
      "tmux-attach",
    ]);

    // Helper to wire up a node-pty or child process to IPC events and lifecycle
    const attachProcess = (
      attachCmd: { program: string; args: string[] },
      tmuxSessionName?: string | null,
    ) => {
      if (this.ptyModule) {
        const pty = this.ptyModule.spawn(attachCmd.program, attachCmd.args, {
          name: "xterm-256color",
          cols,
          rows,
          cwd,
          env: process.env as Record<string, string>,
        });
        instance.pty = pty;
        instance.tmuxSessionName = tmuxSessionName ?? null;

        pty.onData((data: string) => {
          session.status = "ready";
          session.lastActivityAt = Date.now();
          this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
            type: "data",
            id,
            data,
          });
        });
        pty.onExit(({ exitCode }: { exitCode: number }) => {
          session.status = "exited";
          this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
            type: "exit",
            id,
            exitCode,
          });
          this.terminals.delete(id);
        });
        this.terminals.set(id, instance);
        return;
      }

      // Fallback to child_process streams (no pty). We still stream data and allow resizing via tmux commands.
      const child = spawn(attachCmd.program, attachCmd.args, { cwd });
      instance.childProcess = child;
      instance.tmuxSessionName = tmuxSessionName ?? null;

      child.stdout.on("data", (chunk) => {
        const data = String(chunk);
        session.status = "ready";
        session.lastActivityAt = Date.now();
        this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
          type: "data",
          id,
          data,
        });
      });
      child.stderr.on("data", (chunk) => {
        const data = String(chunk);
        session.lastActivityAt = Date.now();
        this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
          type: "data",
          id,
          data,
        });
      });
      child.on("exit", (code) => {
        session.status = "exited";
        this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
          type: "exit",
          id,
          exitCode: code ?? 0,
        });
        this.terminals.delete(id);
      });

      this.terminals.set(id, instance);
    };

    try {
      if (supportsTmux && tmuxBackends.has(backend)) {
        // Create a tmux session (detached) and then attach a pty/child process to it
        const tmuxSessionName = sanitizeSessionName(id);
        const createArgs: string[] = [
          "new-session",
          "-d",
          "-s",
          tmuxSessionName,
          "-c",
          cwd,
        ];
        if (backend === "lazygit") {
          createArgs.push("lazygit");
        } else if (backend === "tmux-attach") {
          // Attach to an existing thread runtime session if linkedThreadId provided
          if (!opts.linkedThreadId) {
            throw new Error("tmux-attach backend requires linkedThreadId");
          }
          const target = createTmuxThreadSessionName(opts.linkedThreadId);
          // create a wrapper session that runs 'tmux attach -t target'
          createArgs.push("tmux", "attach", "-t", target);
        } else {
          // shell backend: start a login shell inside tmux session
          const shell =
            process.platform === "win32"
              ? "powershell.exe"
              : process.env.SHELL || "/bin/zsh";
          createArgs.push(shell);
        }

        const result = this.runTmux(createArgs, cwd);
        if (result.error || result.status !== 0) {
          throw new Error(
            result.error?.message ||
              result.stderr.trim() ||
              "Failed to create tmux session",
          );
        }

        // Disable tmux status bar for the created session so an extra status line
        // does not appear at the top of embedded terminals. This is best-effort;
        // ignore failures to avoid breaking session creation.
        try {
          this.runTmux(["set-option", "-t", tmuxSessionName, "status", "off"], cwd);
        } catch (e) {}

        // Attach to the tmux session via tmux attach -t <session>
        attachProcess(
          { program: this.tmuxBinary, args: ["attach", "-t", tmuxSessionName] },
          tmuxSessionName,
        );
        // update session metadata
        session.tmuxSessionName = tmuxSessionName;
        session.status = "ready";
        session.lastActivityAt = Date.now();
        return session;
      }

      // Fallback: no tmux or backend not supported by tmux
      if (backend === "shell") {
        if (!this.ptyModule) {
          // If node-pty isn't available, surface error (terminal not available)
          const error = this.getError();
          throw new Error(error?.message || "Terminal is not available");
        }
        // Spawn local shell via node-pty as before
        const shell =
          process.platform === "win32"
            ? "powershell.exe"
            : process.env.SHELL || "/bin/zsh";
        const pty = this.ptyModule.spawn(shell, [], {
          name: "xterm-256color",
          cols,
          rows,
          cwd,
          env: process.env as Record<string, string>,
        });
        instance.pty = pty;
        pty.onData((data: string) => {
          session.status = "ready";
          session.lastActivityAt = Date.now();
          this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
            type: "data",
            id,
            data,
          });
        });
        pty.onExit(({ exitCode }: { exitCode: number }) => {
          session.status = "exited";
          this.mainWindow?.webContents.send(IPC_CHANNELS.terminal.create, {
            type: "exit",
            id,
            exitCode,
          });
          this.terminals.delete(id);
        });
        this.terminals.set(id, instance);
        session.status = "ready";
        session.lastActivityAt = Date.now();
        return session;
      }

      // Unsupported backend when tmux not present
      throw new Error(`Unsupported terminal backend without tmux: ${backend}`);
    } catch (error) {
      session.status = "error";
      this.terminals.delete(id);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  write(id: string, data: string): void {
    const instance = this.terminals.get(id);
    if (!instance) return;
    if (instance.pty) {
      instance.pty.write(data);
      return;
    }
    if (
      instance.childProcess?.stdin &&
      !instance.childProcess.stdin.destroyed
    ) {
      instance.childProcess.stdin.write(data);
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const instance = this.terminals.get(id);
    if (!instance) return;
    if (instance.pty) {
      try {
        instance.pty.resize(cols, rows);
      } catch {}
      return;
    }
    // If backed by tmux but we attached via child process, ask tmux to resize the window
    if (instance.tmuxSessionName) {
      try {
        this.runTmux([
          "resize-window",
          "-t",
          instance.tmuxSessionName,
          "-x",
          String(cols),
          "-y",
          String(rows),
        ]);
      } catch {}
    }
  }

  destroy(id: string): void {
    const instance = this.terminals.get(id);
    if (!instance) return;
    try {
      if (instance.pty) {
        try {
          instance.pty.kill();
        } catch {}
      }
      if (instance.childProcess) {
        try {
          instance.childProcess.kill();
        } catch {}
      }
      if (instance.tmuxSessionName) {
        // Attempt to kill the tmux session created for this terminal
        this.runTmux(["kill-session", "-t", instance.tmuxSessionName]);
      }
    } finally {
      this.terminals.delete(id);
    }
  }

  destroyAll(): void {
    for (const id of Array.from(this.terminals.keys())) {
      this.destroy(id);
    }
  }

  get(id: string): TerminalInstance | undefined {
    return this.terminals.get(id);
  }

  getSessions(): TerminalSession[] {
    const sessions: TerminalSession[] = [];
    for (const inst of this.terminals.values()) {
      sessions.push(inst.session);
    }
    return sessions;
  }
}

export const terminalManager = new TerminalManager();
