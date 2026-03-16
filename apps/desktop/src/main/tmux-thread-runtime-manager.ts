import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { reconcileThreadRuntimeStates } from "./runtime-reconcile";
import type {
  ThreadRuntimeDescriptor,
  ThreadRuntimeLaunchSpec,
  ThreadRuntimeManager,
  ThreadRuntimeRef,
} from "./thread-runtime-manager";
import {
  createTmuxThreadSessionName,
  isManagedTmuxThreadSession,
} from "./tmux-session-naming";

type TmuxThreadRuntimeManagerOptions = {
  socketName?: string;
  tmuxBinary?: string;
};

type TmuxCommandResult = {
  status: number;
  stdout: string;
  stderr: string;
  error: Error | null;
};

function shellEscape(argument: string): string {
  if (/^[A-Za-z0-9_./:=,-]+$/.test(argument)) {
    return argument;
  }

  return `'${argument.replace(/'/g, `'"'"'`)}'`;
}

function toCommandString(command: string[]): string {
  return command.map((argument) => shellEscape(argument)).join(" ");
}

function normalizeWorktreePath(worktreePath: string): string {
  return path.resolve(worktreePath);
}

export class TmuxThreadRuntimeManager implements ThreadRuntimeManager {
  private readonly socketName?: string;

  private readonly tmuxBinary: string;

  constructor(options: TmuxThreadRuntimeManagerOptions = {}) {
    this.socketName = options.socketName;
    this.tmuxBinary = options.tmuxBinary ?? "tmux";
  }

  async ensureThreadRuntime(
    spec: ThreadRuntimeLaunchSpec,
  ): Promise<ThreadRuntimeDescriptor> {
    const worktreePath = normalizeWorktreePath(spec.worktreePath);
    const sessionName = createTmuxThreadSessionName(spec.threadId);

    if (!fs.existsSync(worktreePath)) {
      throw new Error(
        `Cannot start thread runtime in missing worktree: ${worktreePath}`,
      );
    }

    if (this.hasSession(sessionName)) {
      return this.createDescriptor(
        spec.threadId,
        worktreePath,
        sessionName,
        "ready",
      );
    }

    const result = this.runTmux(
      [
        "new-session",
        "-d",
        "-s",
        sessionName,
        "-c",
        worktreePath,
        toCommandString(spec.command),
      ],
      worktreePath,
    );

    if (result.error || result.status !== 0) {
      throw new Error(
        result.error?.message ||
          result.stderr.trim() ||
          "Failed to create tmux session",
      );
    }

    return this.createDescriptor(
      spec.threadId,
      worktreePath,
      sessionName,
      "ready",
    );
  }

  async getRuntimeState(
    thread: ThreadRuntimeRef,
  ): Promise<ThreadRuntimeDescriptor> {
    const worktreePath = normalizeWorktreePath(thread.worktreePath);
    const sessionName = createTmuxThreadSessionName(thread.threadId);

    return this.createDescriptor(
      thread.threadId,
      worktreePath,
      sessionName,
      this.hasSession(sessionName) ? "ready" : "exited",
    );
  }

  async restartThreadRuntime(
    spec: ThreadRuntimeLaunchSpec,
  ): Promise<ThreadRuntimeDescriptor> {
    await this.terminateThreadRuntime(spec.threadId);
    return this.ensureThreadRuntime(spec);
  }

  async terminateThreadRuntime(threadId: string): Promise<void> {
    const sessionName = createTmuxThreadSessionName(threadId);

    if (!this.hasSession(sessionName)) {
      return;
    }

    const result = this.runTmux(["kill-session", "-t", sessionName]);
    if (result.error || result.status !== 0) {
      throw new Error(
        result.error?.message ||
          result.stderr.trim() ||
          "Failed to terminate tmux session",
      );
    }
  }

  async reconcile(threads: ThreadRuntimeRef[]) {
    const threadStates = await Promise.all(
      threads.map((thread) => this.getRuntimeState(thread)),
    );
    const managedSessionNames = this.listManagedSessionNames();

    return reconcileThreadRuntimeStates({
      managedSessionNames,
      threadStates,
    });
  }

  private createDescriptor(
    threadId: string,
    worktreePath: string,
    sessionName: string,
    status: ThreadRuntimeDescriptor["status"],
  ): ThreadRuntimeDescriptor {
    return {
      threadId,
      worktreePath,
      sessionName,
      status,
      lastError: null,
    };
  }

  private hasSession(sessionName: string): boolean {
    const result = this.runTmux(["has-session", "-t", sessionName]);
    return result.error === null && result.status === 0;
  }

  private listManagedSessionNames(): string[] {
    const result = this.runTmux(["list-sessions", "-F", "#{session_name}"]);
    if (
      result.status !== 0 &&
      (result.stderr.includes("no server running") ||
        result.stderr.includes("failed to connect to server"))
    ) {
      return [];
    }
    if (result.error || result.status !== 0) {
      throw new Error(
        result.error?.message ||
          result.stderr.trim() ||
          "Failed to list tmux sessions",
      );
    }

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && isManagedTmuxThreadSession(line));
  }

  private runTmux(args: string[], cwd?: string): TmuxCommandResult {
    try {
      const prefixedArgs = this.socketName
        ? ["-L", this.socketName, ...args]
        : args;
      const result = spawnSync(this.tmuxBinary, prefixedArgs, {
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
}
