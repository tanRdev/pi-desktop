import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import type {
  TerminalBackend,
  TerminalCreateOptions,
  TerminalSession,
} from "@pi-desktop/shared";
import { Effect } from "effect";
import type { BrowserWindow } from "electron";
import { createModuleLogger } from "./effect/logger";
import { terminateChildWithEscalation } from "./process-lifecycle";
import { buildEnhancedPath, resolvePiPathOrThrow } from "./resolve-pi-path";
import { resolveLocalShellProgram } from "./terminal/terminal-backends";
import {
  bindChildProcessSessionEvents,
  bindPtySessionEvents,
} from "./terminal/terminal-session-events";

const logger = createModuleLogger("terminal-manager");

/**
 * Per-session cap on cumulative bytes forwarded from the backend PTY
 * to the renderer. Prevents a runaway process (e.g. `yes`) from
 * filling the IPC queue or blowing renderer memory. 16MB is roughly
 * 160k lines of 100-col output, well beyond any interactive session.
 */
const DEFAULT_SCROLLBACK_BYTE_CAP = 16 * 1024 * 1024;

const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`,
  "g",
);

function stripAnsi(input: string): string {
  return input.replace(ANSI_ESCAPE_PATTERN, "");
}

const nodeRequire = createRequire(import.meta.url);

type PtyModule = typeof import("node-pty");
type SpawnProcess = typeof spawn;
type NodeRequire = ReturnType<typeof createRequire>;

export interface TerminalInstance {
  session: TerminalSession;
  pty?: import("node-pty").IPty | null;
  childProcess?: ReturnType<typeof spawn> | null;
  /**
   * Stable key identifying the renderer that created this terminal. In
   * production this is the Electron WebContents id (number); in tests it
   * may be a synthetic string. Subsequent write/resize/destroy IPC calls
   * must originate from the same sender to be accepted.
   */
  ownerWebContentsId?: number | string;
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

function runTerminalOperation(operation: () => void): void {
  void Effect.runSync(
    Effect.either(
      Effect.try({
        try: operation,
        catch: () => undefined,
      }),
    ),
  );
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

  create(
    id: string,
    opts: TerminalCreateOptions,
    ownerWebContentsId?: number | string,
  ): TerminalSession {
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
      ownerWebContentsId,
    };

    const handleAttachedProcessExit = () => {
      void Effect.runPromise(
        logger.info(`session ${stripAnsi(id)} exited; cleaning up`),
      ).catch(() => undefined);
      const current = this.terminals.get(id);
      if (current) {
        current.pty = null;
        current.childProcess = null;
      }
      this.terminals.delete(id);
    };

    const handleScrollbackCapReached = (bytesDropped: number) => {
      void Effect.runPromise(
        logger.warn(
          `session ${stripAnsi(id)} exceeded scrollback cap (${bytesDropped} bytes); dropping further output`,
        ),
      ).catch(() => undefined);
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
          scrollbackByteCap: DEFAULT_SCROLLBACK_BYTE_CAP,
          onScrollbackCapReached: handleScrollbackCapReached,
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
        scrollbackByteCap: DEFAULT_SCROLLBACK_BYTE_CAP,
        onScrollbackCapReached: handleScrollbackCapReached,
      });

      this.terminals.set(id, instance);
    };

    try {
      const program =
        backend === "pi"
          ? resolvePiPathOrThrow()
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
              PATH: buildEnhancedPath(),
            }
          : this.env;

      attachProcess({
        program,
        args,
        env,
      });
      session.status = "ready";
      session.lastActivityAt = this.now();
      void Effect.runPromise(
        logger.info(
          `created session ${stripAnsi(id)} backend=${backend} cwd=${cwd}`,
        ),
      ).catch(() => undefined);
      return session;
    } catch (error) {
      session.status = "error";
      this.terminals.delete(id);
      void Effect.runPromise(
        logger.error(`failed to create session ${stripAnsi(id)}`, error),
      ).catch(() => undefined);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Returns true when the terminal has no recorded owner (e.g. created by
   * test harness) or when the caller's sender key matches the recorded
   * owner. Operations from other senders are rejected.
   */
  isOwnedBy(id: string, senderKey: number | string): boolean {
    const instance = this.terminals.get(id);
    if (!instance) return false;
    if (instance.ownerWebContentsId === undefined) return true;
    return instance.ownerWebContentsId === senderKey;
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
      runTerminalOperation(() => {
        instance.pty?.resize(cols, rows);
      });
    }
  }

  destroy(id: string): void {
    const instance = this.terminals.get(id);
    if (!instance) return;
    try {
      if (instance.pty) {
        // node-pty's kill() already issues SIGHUP then cleans up the PTY fd.
        // For the non-pty fallback path below we escalate manually.
        runTerminalOperation(() => {
          instance.pty?.kill();
        });
      }
      if (instance.childProcess) {
        const child = instance.childProcess;
        void terminateChildWithEscalation(child).catch(() => {
          /* swallow: best-effort cleanup */
        });
      }
    } finally {
      instance.pty = null;
      instance.childProcess = null;
      this.terminals.delete(id);
      void Effect.runPromise(
        logger.info(`destroyed session ${stripAnsi(id)}`),
      ).catch(() => undefined);
    }
  }

  async destroyAsync(id: string): Promise<void> {
    const instance = this.terminals.get(id);
    if (!instance) return;
    try {
      if (instance.pty) {
        runTerminalOperation(() => {
          instance.pty?.kill();
        });
      }
      if (instance.childProcess) {
        await terminateChildWithEscalation(instance.childProcess);
      }
    } finally {
      instance.pty = null;
      instance.childProcess = null;
      this.terminals.delete(id);
      void Effect.runPromise(
        logger.info(`destroyed session ${stripAnsi(id)} (async)`),
      ).catch(() => undefined);
    }
  }

  destroyAll(): void {
    for (const id of Array.from(this.terminals.keys())) {
      this.destroy(id);
    }
  }

  async destroyAllAsync(): Promise<void> {
    await Promise.all(
      Array.from(this.terminals.keys()).map((id) => this.destroyAsync(id)),
    );
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
