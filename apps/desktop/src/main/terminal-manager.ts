import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import type {
  TerminalBackend,
  TerminalCreateOptions,
  TerminalSession,
} from "@pidesk/shared";
import type { BrowserWindow } from "electron";
import { resolveLocalShellProgram } from "./terminal/terminal-backends";
import {
  bindChildProcessSessionEvents,
  bindPtySessionEvents,
} from "./terminal/terminal-session-events";

const nodeRequire = createRequire(import.meta.url);

type PtyModule = typeof import("node-pty");
type SpawnProcess = typeof spawn;
type NodeRequire = ReturnType<typeof createRequire>;

export interface TerminalInstance {
  session: TerminalSession;
  pty?: import("node-pty").IPty | null;
  childProcess?: ReturnType<typeof spawn> | null;
}

export interface TerminalManagerDependencies {
  spawn?: SpawnProcess;
  nodeRequire?: NodeRequire;
  ptyModule?: PtyModule | null;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  cwd?: () => string;
  now?: () => number;
}

function createDefaultDependencies(): Required<
  Omit<TerminalManagerDependencies, "ptyModule">
> & {
  ptyModule: PtyModule | null;
} {
  return {
    spawn,
    nodeRequire,
    ptyModule: null,
    env: process.env,
    platform: process.platform,
    cwd: () => process.cwd(),
    now: () => Date.now(),
  };
}

export class TerminalManager {
  private terminals: Map<string, TerminalInstance> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private ptyModule: PtyModule | null = null;
  private initError: Error | null = null;
  private readonly spawnProcess: SpawnProcess;
  private readonly loadModule: NodeRequire;
  private readonly env: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly getCwd: () => string;
  private readonly now: () => number;

  constructor(dependencies: TerminalManagerDependencies = {}) {
    const resolved = {
      ...createDefaultDependencies(),
      ...dependencies,
    };

    this.spawnProcess = resolved.spawn;
    this.loadModule = resolved.nodeRequire;
    this.ptyModule = resolved.ptyModule;
    this.env = resolved.env;
    this.platform = resolved.platform;
    this.getCwd = resolved.cwd;
    this.now = resolved.now;
  }

  initialize(): void {
    if (this.ptyModule) {
      this.initError = null;
      return;
    }

    try {
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
    return this.ptyModule !== null || this.spawnProcess !== undefined;
  }

  getError(): Error | null {
    return this.initError;
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
    };

    const handleAttachedProcessExit = () => {
      this.terminals.delete(id);
    };

    const attachProcess = (attachCmd: {
      program: string;
      args: string[];
      env?: NodeJS.ProcessEnv;
    }) => {
      if (this.ptyModule) {
        const pty = this.ptyModule.spawn(attachCmd.program, attachCmd.args, {
          name: "xterm-256color",
          cols,
          rows,
          cwd,
          env: (attachCmd.env ?? this.env) as Record<string, string>,
        });
        instance.pty = pty;

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

      const child = this.spawnProcess(attachCmd.program, attachCmd.args, {
        cwd,
        env: attachCmd.env,
      });
      instance.childProcess = child;

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
      const program =
        backend === "pi"
          ? "pi"
          : resolveLocalShellProgram({
              platform: this.platform,
              shell: this.env.SHELL,
            });

      const args = backend === "pi" ? ["--continue"] : [];

      const env =
        backend === "pi"
          ? {
              ...this.env,
              PI_CODING_AGENT_DIR:
                this.env.PI_CODING_AGENT_DIR ?? path.join(cwd, ".pi", "agent"),
            }
          : this.env;

      attachProcess({
        program,
        args,
        env,
      });
      session.status = "ready";
      session.lastActivityAt = this.now();
      return session;
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
