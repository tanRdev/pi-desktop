import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { terminateChildWithEscalation } from "./process-lifecycle";
import { buildEnhancedPath, resolvePiPath } from "./resolve-pi-path";
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
  terminationPromise: Promise<void> | null;
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
  return child.exitCode === null && child.signalCode === null;
}

function createThreadRuntimeEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const piPath = resolvePiPath();
  return {
    ...baseEnv,
    PATH: buildEnhancedPath(),
    ...(piPath ? { PI_CLI_PATH: piPath } : {}),
  };
}

export class LocalThreadRuntimeManager implements ThreadRuntimeManager {
  private readonly runtimes = new Map<string, RuntimeProcessRecord>();
  private isShuttingDown = false;
  private terminateAllPromise: Promise<void> | null = null;

  private assertRuntimeStartsAllowed(): void {
    if (this.isShuttingDown) {
      throw new Error("Thread runtime manager is shutting down");
    }
  }

  async ensureThreadRuntime(
    spec: ThreadRuntimeLaunchSpec,
  ): Promise<ThreadRuntimeDescriptor> {
    this.assertRuntimeStartsAllowed();
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
      existing.terminationPromise === null &&
      isChildRunning(existing.child)
    ) {
      existing.descriptor.status = "ready";
      existing.descriptor.lastError = null;
      return { ...existing.descriptor };
    }

    await this.terminateThreadRuntime(spec.threadId);
    this.assertRuntimeStartsAllowed();

    const [program, ...args] = spec.command;
    if (!program) {
      throw new Error("Thread runtime command must not be empty");
    }

    const descriptor: ThreadRuntimeDescriptor = {
      threadId: spec.threadId,
      worktreePath,
      runtimeId: createRuntimeId(spec.threadId),
      status: "starting",
      lastError: null,
    };

    const child = spawn(program, args, {
      cwd: worktreePath,
      env: createThreadRuntimeEnv(),
      stdio: "ignore",
    });

    const record: RuntimeProcessRecord = {
      child,
      commandSignature: nextCommandSignature,
      descriptor,
      terminationPromise: null,
    };

    child.once("spawn", () => {
      descriptor.status = "ready";
      descriptor.lastError = null;
    });

    child.once("error", (error) => {
      descriptor.status = "error";
      const isEnoent =
        "code" in error && (error as { code: string }).code === "ENOENT";
      descriptor.lastError = isEnoent
        ? `Could not find '${program}' on PATH. Make sure it is installed and accessible.`
        : error.message;
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
        runtimeId: createRuntimeId(thread.threadId),
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
    this.assertRuntimeStartsAllowed();
    await this.terminateThreadRuntime(spec.threadId);
    this.assertRuntimeStartsAllowed();
    return this.ensureThreadRuntime(spec);
  }

  terminateThreadRuntime(threadId: string): Promise<void> {
    const runtime = this.runtimes.get(threadId);
    if (!runtime) {
      return Promise.resolve();
    }

    return this.terminateRuntimeRecord(threadId, runtime);
  }

  private terminateRuntimeRecord(
    threadId: string,
    runtime: RuntimeProcessRecord,
  ): Promise<void> {
    if (runtime.terminationPromise) {
      return runtime.terminationPromise;
    }

    const terminationPromise = (async () => {
      if (isChildRunning(runtime.child)) {
        await terminateChildWithEscalation(runtime.child);
      }

      runtime.descriptor.status = "exited";
      if (this.runtimes.get(threadId) === runtime) {
        this.runtimes.delete(threadId);
      }
    })();
    runtime.terminationPromise = terminationPromise;
    void terminationPromise.then(
      () => {
        if (runtime.terminationPromise === terminationPromise) {
          runtime.terminationPromise = null;
        }
      },
      () => {
        if (runtime.terminationPromise === terminationPromise) {
          runtime.terminationPromise = null;
        }
      },
    );

    return terminationPromise;
  }

  terminateAll(): Promise<void> {
    this.isShuttingDown = true;
    if (this.terminateAllPromise) {
      return this.terminateAllPromise;
    }

    const runtimes = Array.from(this.runtimes.entries());
    const terminateAllPromise = Promise.allSettled(
      runtimes.map(([threadId, runtime]) =>
        this.terminateRuntimeRecord(threadId, runtime),
      ),
    ).then((results) => {
      const errors = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );

      if (errors.length > 0) {
        throw new AggregateError(
          errors,
          `Failed to terminate ${errors.length} thread runtime${errors.length === 1 ? "" : "s"}`,
        );
      }
    });
    this.terminateAllPromise = terminateAllPromise;
    void terminateAllPromise.then(
      () => {
        if (this.terminateAllPromise === terminateAllPromise) {
          this.terminateAllPromise = null;
        }
      },
      () => {
        if (this.terminateAllPromise === terminateAllPromise) {
          this.terminateAllPromise = null;
        }
      },
    );

    return terminateAllPromise;
  }

  async reconcile(threads: ThreadRuntimeRef[]) {
    const threadStates = await Promise.all(
      threads.map((thread) => this.getRuntimeState(thread)),
    );

    return reconcileThreadRuntimeStates({
      managedRuntimeIds: Array.from(this.runtimes.values()).map(
        (runtime) => runtime.descriptor.runtimeId,
      ),
      threadStates,
    });
  }
}
