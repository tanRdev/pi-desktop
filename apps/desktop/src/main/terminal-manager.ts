import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import type {
  TerminalBackend,
  TerminalCreateOptions,
  TerminalSession,
} from "@pidesk/shared";
import type { BrowserWindow } from "electron";
import {
  buildTmuxLaunchSpec,
  isTmuxLaunchBackend,
  resolveLocalShellProgram,
} from "./terminal/terminal-backends";
import {
  bindChildProcessSessionEvents,
  bindPtySessionEvents,
} from "./terminal/terminal-session-events";

const nodeRequire = createRequire(import.meta.url);

type PtyModule = typeof import("node-pty");
type SpawnProcess = typeof spawn;
type SpawnSyncProcess = typeof spawnSync;
type NodeRequire = ReturnType<typeof createRequire>;

export interface TerminalInstance {
  session: TerminalSession;
  // node-pty IPty when used to attach to tmux or spawn a local shell
  pty?: import("node-pty").IPty | null;
  // fallback child process when node-pty is not available
  childProcess?: ReturnType<typeof spawn> | null;
  // tmux session name if backed by tmux
  tmuxSessionName?: string | null;
}

export interface TerminalManagerDependencies {
  spawn?: SpawnProcess;
  spawnSync?: SpawnSyncProcess;
  nodeRequire?: NodeRequire;
  ptyModule?: PtyModule | null;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  cwd?: () => string;
  now?: () => number;
  tmuxBinary?: string;
}

function createDefaultDependencies(): Required<
  Omit<TerminalManagerDependencies, "ptyModule">
> & {
  ptyModule: PtyModule | null;
} {
  return {
    spawn,
    spawnSync,
    nodeRequire,
    ptyModule: null,
    env: process.env,
    platform: process.platform,
    cwd: () => process.cwd(),
    now: () => Date.now(),
    tmuxBinary: "tmux",
  };
}

export class TerminalManager {
  private terminals: Map<string, TerminalInstance> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private ptyModule: PtyModule | null = null;
  private initError: Error | null = null;
  private readonly spawnProcess: SpawnProcess;
  private readonly spawnSyncProcess: SpawnSyncProcess;
  private readonly loadModule: NodeRequire;
  private readonly env: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly getCwd: () => string;
  private readonly now: () => number;
  private readonly tmuxBinary: string;

  constructor(dependencies: TerminalManagerDependencies = {}) {
    const resolved = {
      ...createDefaultDependencies(),
      ...dependencies,
    };

    this.spawnProcess = resolved.spawn;
    this.spawnSyncProcess = resolved.spawnSync;
    this.loadModule = resolved.nodeRequire;
    this.ptyModule = resolved.ptyModule;
    this.env = resolved.env;
    this.platform = resolved.platform;
    this.getCwd = resolved.cwd;
    this.now = resolved.now;
    this.tmuxBinary = resolved.tmuxBinary;
  }

  initialize(): void {
    if (this.ptyModule) {
      this.initError = null;
      return;
    }

    try {
      // Use require for native modules with electron-vite
      this.ptyModule = this.loadModule("node-pty") as PtyModule;
      this.initError = null;
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
      const result = this.spawnSyncProcess(this.tmuxBinary, ["-V"], {
        encoding: "utf8",
      });
      return result.status === 0 && result.error == null;
    } catch {
      return false;
    }
  }

  private runTmux(args: string[], cwd?: string) {
    try {
      const result = this.spawnSyncProcess(this.tmuxBinary, args, {
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

    const cwd = opts.cwd ?? this.getCwd();
    const createdAt = this.now();

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

    const handleAttachedProcessExit = () => {
      if (instance.tmuxSessionName) {
        try {
          this.runTmux(["kill-session", "-t", instance.tmuxSessionName]);
        } catch {}
      }

      this.terminals.delete(id);
    };

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
          env: this.env as Record<string, string>,
        });
        instance.pty = pty;
        instance.tmuxSessionName = tmuxSessionName ?? null;

        bindPtySessionEvents({
          pty,
          session,
          id,
          mainWindow: this.mainWindow,
          onExit: handleAttachedProcessExit,
        });
        this.terminals.set(id, instance);
        return;
      }

      // Fallback to child_process streams (no pty). We still stream data and allow resizing via tmux commands.
      const child = this.spawnProcess(attachCmd.program, attachCmd.args, {
        cwd,
      });
      instance.childProcess = child;
      instance.tmuxSessionName = tmuxSessionName ?? null;

      bindChildProcessSessionEvents({
        child,
        session,
        id,
        mainWindow: this.mainWindow,
        onExit: handleAttachedProcessExit,
      });

      this.terminals.set(id, instance);
    };

    try {
      if (supportsTmux && isTmuxLaunchBackend(backend)) {
        // Create a tmux session (detached) and then attach a pty/child process to it
        const launchSpec = buildTmuxLaunchSpec({
          id,
          backend,
          cwd,
          linkedThreadId: opts.linkedThreadId,
          platform: this.platform,
          shell: this.env.SHELL,
          tmuxBinary: this.tmuxBinary,
        });

        const result = this.runTmux(launchSpec.createArgs, cwd);
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
          this.runTmux(
            ["set-option", "-t", launchSpec.tmuxSessionName, "status", "off"],
            cwd,
          );
        } catch {}

        // Attach to the tmux session via tmux attach -t <session>
        attachProcess(launchSpec.attachCommand, launchSpec.tmuxSessionName);
        // update session metadata
        session.tmuxSessionName = launchSpec.tmuxSessionName;
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
        attachProcess({
          program: resolveLocalShellProgram({
            platform: this.platform,
            shell: this.env.SHELL,
          }),
          args: [],
        });
        session.status = "ready";
        session.lastActivityAt = this.now();
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
