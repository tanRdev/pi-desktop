import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const resolvePiPathMock = vi.fn(() => null as string | null);
const buildEnhancedPathMock = vi.fn(() => "/enhanced/bin:/usr/bin");
const terminateChildWithEscalationMock = vi.fn<
  (child: unknown) => Promise<void>
>(async () => undefined);

vi.mock("node:child_process", () => {
  const spawn = (...args: unknown[]) => spawnMock(...args);
  return {
    default: { spawn },
    spawn,
  };
});

vi.mock("./resolve-pi-path", () => ({
  resolvePiPath: () => resolvePiPathMock(),
  buildEnhancedPath: () => buildEnhancedPathMock(),
}));

vi.mock("./process-lifecycle", () => ({
  terminateChildWithEscalation: (child: unknown) =>
    terminateChildWithEscalationMock(child),
}));

vi.mock("./runtime-reconcile", () => ({
  reconcileThreadRuntimeStates: vi.fn((descriptors) => descriptors),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
  };
});

import { LocalThreadRuntimeManager } from "./local-thread-runtime-manager";

function createFakeChild() {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    exitCode: null,
    signalCode: null,
    killed: false,
    once(event: string, handler: (...args: unknown[]) => void) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    emit(event: string, ...args: unknown[]) {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe("LocalThreadRuntimeManager", () => {
  afterEach(() => {
    spawnMock.mockReset();
    resolvePiPathMock.mockReset();
    resolvePiPathMock.mockReturnValue(null);
    buildEnhancedPathMock.mockClear();
    terminateChildWithEscalationMock.mockReset();
    terminateChildWithEscalationMock.mockResolvedValue(undefined);
  });

  it("passes enhanced PATH and PI_CLI_PATH into thread runtime spawn env", async () => {
    resolvePiPathMock.mockReturnValue("/opt/homebrew/bin/pi");
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const manager = new LocalThreadRuntimeManager();
    await manager.ensureThreadRuntime({
      threadId: "thread-1",
      worktreePath: process.cwd(),
      command: ["env", "ELECTRON_RUN_AS_NODE=1", "/bin/electron", "entry.js"],
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "env",
      ["ELECTRON_RUN_AS_NODE=1", "/bin/electron", "entry.js"],
      expect.objectContaining({
        cwd: process.cwd(),
        env: expect.objectContaining({
          PATH: "/enhanced/bin:/usr/bin",
          PI_CLI_PATH: "/opt/homebrew/bin/pi",
        }),
      }),
    );
  });

  it("omits PI_CLI_PATH when Pi is not installed", async () => {
    resolvePiPathMock.mockReturnValue(null);
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const manager = new LocalThreadRuntimeManager();
    await manager.ensureThreadRuntime({
      threadId: "thread-2",
      worktreePath: process.cwd(),
      command: ["env", "ELECTRON_RUN_AS_NODE=1", "/bin/electron", "entry.js"],
    });

    const spawnEnv = spawnMock.mock.calls[0]?.[2]?.env as NodeJS.ProcessEnv;
    expect(spawnEnv.PATH).toBe("/enhanced/bin:/usr/bin");
    expect(spawnEnv.PI_CLI_PATH).toBeUndefined();
  });

  it("blocks replacement spawn and coalesces shutdown with an in-flight restart", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const manager = new LocalThreadRuntimeManager();
    await manager.ensureThreadRuntime({
      threadId: "thread-1",
      worktreePath: process.cwd(),
      command: ["runtime-one"],
    });

    const childTermination = createDeferred<void>();
    terminateChildWithEscalationMock.mockReturnValue(childTermination.promise);
    const restart = manager.restartThreadRuntime({
      threadId: "thread-1",
      worktreePath: process.cwd(),
      command: ["runtime-two"],
    });

    const firstShutdown = manager.terminateAll();
    const secondShutdown = manager.terminateAll();

    expect(secondShutdown).toBe(firstShutdown);
    expect(terminateChildWithEscalationMock).toHaveBeenCalledTimes(1);

    childTermination.resolve();

    await expect(restart).rejects.toThrow(/shutting down/u);
    await Promise.all([firstShutdown, secondShutdown]);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("blocks an in-flight ensure before it can spawn during shutdown", async () => {
    const manager = new LocalThreadRuntimeManager();
    const ensure = manager.ensureThreadRuntime({
      threadId: "thread-1",
      worktreePath: process.cwd(),
      command: ["runtime-one"],
    });

    await manager.terminateAll();

    await expect(ensure).rejects.toThrow(/shutting down/u);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("coalesces overlapping termination without deleting a replacement runtime", async () => {
    const firstChild = createFakeChild();
    const replacementChild = createFakeChild();
    spawnMock
      .mockReturnValueOnce(firstChild)
      .mockReturnValueOnce(replacementChild);

    const manager = new LocalThreadRuntimeManager();
    await manager.ensureThreadRuntime({
      threadId: "thread-1",
      worktreePath: process.cwd(),
      command: ["runtime-one"],
    });

    const firstTermination = createDeferred<void>();
    const staleTermination = createDeferred<void>();
    terminateChildWithEscalationMock
      .mockReturnValueOnce(firstTermination.promise)
      .mockReturnValueOnce(staleTermination.promise);
    const restart = manager.restartThreadRuntime({
      threadId: "thread-1",
      worktreePath: process.cwd(),
      command: ["runtime-two"],
    });
    const overlappingTermination = manager.terminateThreadRuntime("thread-1");

    expect(terminateChildWithEscalationMock).toHaveBeenCalledTimes(1);

    firstTermination.resolve();
    await restart;
    await overlappingTermination;

    await expect(
      manager.getRuntimeState({
        threadId: "thread-1",
        worktreePath: process.cwd(),
      }),
    ).resolves.toMatchObject({ status: "ready" });
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it("drains all running runtimes once and makes later shutdown a no-op", async () => {
    const firstChild = createFakeChild();
    const secondChild = createFakeChild();
    secondChild.killed = true;
    spawnMock.mockReturnValueOnce(firstChild).mockReturnValueOnce(secondChild);

    const manager = new LocalThreadRuntimeManager();
    await manager.ensureThreadRuntime({
      threadId: "thread-1",
      worktreePath: process.cwd(),
      command: ["runtime-one"],
    });
    await manager.ensureThreadRuntime({
      threadId: "thread-2",
      worktreePath: process.cwd(),
      command: ["runtime-two"],
    });

    const firstTermination = createDeferred<void>();
    const secondTermination = createDeferred<void>();
    terminateChildWithEscalationMock.mockImplementation((child) => {
      if (child === firstChild) {
        return firstTermination.promise;
      }
      if (child === secondChild) {
        return secondTermination.promise;
      }
      throw new Error("Unexpected child process");
    });
    const shutdown = manager.terminateAll();

    expect(terminateChildWithEscalationMock).toHaveBeenCalledTimes(2);
    firstTermination.resolve();
    secondTermination.resolve();
    await shutdown;
    await manager.terminateAll();
    expect(terminateChildWithEscalationMock).toHaveBeenCalledTimes(2);
    await expect(
      manager.getRuntimeState({
        threadId: "thread-1",
        worktreePath: process.cwd(),
      }),
    ).resolves.toMatchObject({ status: "exited" });
    await expect(
      manager.getRuntimeState({
        threadId: "thread-2",
        worktreePath: process.cwd(),
      }),
    ).resolves.toMatchObject({ status: "exited" });
  });

  it("retains failed runtimes for retry while draining successful runtimes", async () => {
    const firstChild = createFakeChild();
    const secondChild = createFakeChild();
    spawnMock.mockReturnValueOnce(firstChild).mockReturnValueOnce(secondChild);

    const manager = new LocalThreadRuntimeManager();
    await manager.ensureThreadRuntime({
      threadId: "thread-1",
      worktreePath: process.cwd(),
      command: ["runtime-one"],
    });
    await manager.ensureThreadRuntime({
      threadId: "thread-2",
      worktreePath: process.cwd(),
      command: ["runtime-two"],
    });

    const firstTermination = createDeferred<void>();
    const secondTermination = createDeferred<void>();
    terminateChildWithEscalationMock.mockImplementation((child) => {
      if (child === firstChild) {
        return firstTermination.promise;
      }
      if (child === secondChild) {
        return secondTermination.promise;
      }
      throw new Error("Unexpected child process");
    });

    const termination = manager.terminateAll();

    expect(terminateChildWithEscalationMock).toHaveBeenCalledTimes(2);
    expect(terminateChildWithEscalationMock).toHaveBeenCalledWith(firstChild);
    expect(terminateChildWithEscalationMock).toHaveBeenCalledWith(secondChild);

    let settled = false;
    const observedTermination = termination.then(
      () => {
        settled = true;
        return null;
      },
      (error: unknown) => {
        settled = true;
        return error;
      },
    );
    const terminationFailure = new Error("first runtime did not terminate");
    firstTermination.reject(terminationFailure);
    await Promise.resolve();

    expect(settled).toBe(false);

    secondTermination.resolve();
    const aggregateError = await observedTermination;

    expect(aggregateError).toBeInstanceOf(AggregateError);
    expect((aggregateError as AggregateError).errors).toEqual([
      terminationFailure,
    ]);
    await expect(
      manager.getRuntimeState({
        threadId: "thread-1",
        worktreePath: process.cwd(),
      }),
    ).resolves.toMatchObject({ status: "ready" });
    await expect(
      manager.getRuntimeState({
        threadId: "thread-2",
        worktreePath: process.cwd(),
      }),
    ).resolves.toMatchObject({ status: "exited" });

    terminateChildWithEscalationMock.mockImplementation((child) => {
      if (child === firstChild) {
        return Promise.resolve();
      }
      throw new Error("Successfully drained runtime was retried");
    });
    await manager.terminateAll();

    expect(terminateChildWithEscalationMock).toHaveBeenCalledTimes(3);
    await expect(
      manager.getRuntimeState({
        threadId: "thread-1",
        worktreePath: process.cwd(),
      }),
    ).resolves.toMatchObject({ status: "exited" });
    await expect(
      manager.ensureThreadRuntime({
        threadId: "thread-3",
        worktreePath: process.cwd(),
        command: ["runtime-three"],
      }),
    ).rejects.toThrow(/shutting down/u);
  });
});
