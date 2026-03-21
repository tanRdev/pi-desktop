import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { reconcileThreadRuntimeStates } from "./runtime-reconcile";
import type {
  ThreadRuntimeDescriptor,
  ThreadRuntimeLaunchSpec,
  ThreadRuntimeManager,
  ThreadRuntimeRef,
} from "./thread-runtime-manager";

type RuntimeProcessRecord = {
  child: ReturnType<typeof spawn>;
  commandSignature: string;
  descriptor: ThreadRuntimeDescriptor;
};

function normalizeWorktreePath(worktreePath: string): string {
  return path.resolve(worktreePath);
}

function createRuntimeId(threadId: string): string {
  return `local-${threadId}`;
}

function createCommandSignature(command: string[]): string {
  return JSON.stringify(command);
}

function isChildRunning(child: ReturnType<typeof spawn>): boolean {
  return child.exitCode === null && child.signalCode === null && !child.killed;
}

export class LocalThreadRuntimeManager implements ThreadRuntimeManager {
  private readonly runtimes = new Map<string, RuntimeProcessRecord>();

  async ensureThreadRuntime(
    spec: ThreadRuntimeLaunchSpec,
  ): Promise<ThreadRuntimeDescriptor> {
    const worktreePath = normalizeWorktreePath(spec.worktreePath);
    const existing = this.runtimes.get(spec.threadId);
    const nextCommandSignature = createCommandSignature(spec.command);

    if (!existsSync(worktreePath)) {
      throw new Error(
        `Cannot start thread runtime in missing worktree: ${worktreePath}`,
      );
    }

    if (
      existing &&
      existing.descriptor.worktreePath === worktreePath &&
      existing.commandSignature === nextCommandSignature &&
      isChildRunning(existing.child)
    ) {
      existing.descriptor.status = "ready";
      existing.descriptor.lastError = null;
      return { ...existing.descriptor };
    }

    await this.terminateThreadRuntime(spec.threadId);

    const [program, ...args] = spec.command;
    if (!program) {
      throw new Error("Thread runtime command must not be empty");
    }

    const descriptor: ThreadRuntimeDescriptor = {
      threadId: spec.threadId,
      worktreePath,
      sessionName: createRuntimeId(spec.threadId),
      status: "starting",
      lastError: null,
    };

    const child = spawn(program, args, {
      cwd: worktreePath,
      env: process.env,
      stdio: "ignore",
    });

    const record: RuntimeProcessRecord = {
      child,
      commandSignature: nextCommandSignature,
      descriptor,
    };

    child.once("spawn", () => {
      descriptor.status = "ready";
      descriptor.lastError = null;
    });

    child.once("error", (error) => {
      descriptor.status = "error";
      descriptor.lastError = error.message;
    });

    child.once("exit", (exitCode, signalCode) => {
      descriptor.status = "exited";
      descriptor.lastError =
        exitCode === 0 && signalCode === null
          ? null
          : `Runtime exited (${exitCode ?? signalCode ?? "unknown"})`;
    });

    this.runtimes.set(spec.threadId, record);

    descriptor.status = "ready";
    return { ...descriptor };
  }

  async getRuntimeState(
    thread: ThreadRuntimeRef,
  ): Promise<ThreadRuntimeDescriptor> {
    const worktreePath = normalizeWorktreePath(thread.worktreePath);
    const runtime = this.runtimes.get(thread.threadId);

    if (!runtime) {
      return {
        threadId: thread.threadId,
        worktreePath,
        sessionName: createRuntimeId(thread.threadId),
        status: "exited",
        lastError: null,
      };
    }

    return {
      ...runtime.descriptor,
      worktreePath,
      status: isChildRunning(runtime.child)
        ? runtime.descriptor.status === "error"
          ? "error"
          : "ready"
        : runtime.descriptor.status,
    };
  }

  async restartThreadRuntime(
    spec: ThreadRuntimeLaunchSpec,
  ): Promise<ThreadRuntimeDescriptor> {
    await this.terminateThreadRuntime(spec.threadId);
    return this.ensureThreadRuntime(spec);
  }

  async terminateThreadRuntime(threadId: string): Promise<void> {
    const runtime = this.runtimes.get(threadId);
    if (!runtime) {
      return;
    }

    if (isChildRunning(runtime.child)) {
      runtime.child.kill();
    }

    runtime.descriptor.status = "exited";
    this.runtimes.delete(threadId);
  }

  async reconcile(threads: ThreadRuntimeRef[]) {
    const threadStates = await Promise.all(
      threads.map((thread) => this.getRuntimeState(thread)),
    );

    return reconcileThreadRuntimeStates({
      managedSessionNames: Array.from(this.runtimes.values()).map(
        (runtime) => runtime.descriptor.sessionName,
      ),
      threadStates,
    });
  }
}
