import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const resolvePiPathMock = vi.fn(() => null as string | null);
const buildEnhancedPathMock = vi.fn(() => "/enhanced/bin:/usr/bin");

vi.mock("node:child_process", () => {
  const mocked = {
    spawn: (...args: unknown[]) => spawnMock(...args),
  };
  return { ...mocked, default: mocked };
});

vi.mock("./resolve-pi-path", () => ({
  resolvePiPath: () => resolvePiPathMock(),
  buildEnhancedPath: () => buildEnhancedPathMock(),
}));

vi.mock("./process-lifecycle", () => ({
  terminateChildWithEscalation: vi.fn(async () => undefined),
}));

vi.mock("./runtime-reconcile", () => ({
  reconcileThreadRuntimeStates: vi.fn((descriptors) => descriptors),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const mocked = {
    ...actual,
    existsSync: vi.fn(() => true),
  };
  return { ...mocked, default: mocked };
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

describe("LocalThreadRuntimeManager", () => {
  afterEach(() => {
    spawnMock.mockReset();
    resolvePiPathMock.mockReset();
    resolvePiPathMock.mockReturnValue(null);
    buildEnhancedPathMock.mockClear();
  });

  it("passes enhanced PATH and PI_CLI_PATH into thread runtime spawn env", async () => {
    resolvePiPathMock.mockReturnValue("/opt/homebrew/bin/pi");
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const manager = new LocalThreadRuntimeManager();
    await manager.ensureThreadRuntime({
      threadId: "thread-1",
      worktreePath: "/tmp/repo",
      command: ["env", "ELECTRON_RUN_AS_NODE=1", "/bin/electron", "entry.js"],
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "env",
      ["ELECTRON_RUN_AS_NODE=1", "/bin/electron", "entry.js"],
      expect.objectContaining({
        cwd: "/tmp/repo",
        env: expect.objectContaining({
          PATH: "/enhanced/bin:/usr/bin",
          PI_CLI_PATH: "/opt/homebrew/bin/pi",
        }),
      }),
    );
  });

  it("keeps the runtime starting until the child process spawns", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const manager = new LocalThreadRuntimeManager();
    const descriptor = await manager.ensureThreadRuntime({
      threadId: "thread-starting",
      worktreePath: "/tmp/repo",
      command: ["/bin/electron", "entry.js"],
    });

    expect(descriptor.status).toBe("starting");
    expect(descriptor.lastError).toBeNull();

    // Still starting while the child exists but has not spawned yet.
    const beforeSpawn = await manager.getRuntimeState({
      threadId: "thread-starting",
      worktreePath: "/tmp/repo",
    });
    expect(beforeSpawn.status).toBe("starting");

    child.emit("spawn");

    const afterSpawn = await manager.getRuntimeState({
      threadId: "thread-starting",
      worktreePath: "/tmp/repo",
    });
    expect(afterSpawn.status).toBe("ready");
    expect(afterSpawn.lastError).toBeNull();

    // Re-ensuring the same runtime reports the spawned state.
    const again = await manager.ensureThreadRuntime({
      threadId: "thread-starting",
      worktreePath: "/tmp/repo",
      command: ["/bin/electron", "entry.js"],
    });
    expect(again.status).toBe("ready");
    expect(spawnMock).toHaveBeenCalledOnce();
  });

  it("reports an error instead of ready when spawning fails", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const manager = new LocalThreadRuntimeManager();
    const descriptor = await manager.ensureThreadRuntime({
      threadId: "thread-enoent",
      worktreePath: "/tmp/repo",
      command: ["missing-program", "entry.js"],
    });
    expect(descriptor.status).toBe("starting");

    const enoent = new Error("spawn missing-program ENOENT");
    Object.assign(enoent, { code: "ENOENT" });
    child.emit("error", enoent);

    const state = await manager.getRuntimeState({
      threadId: "thread-enoent",
      worktreePath: "/tmp/repo",
    });
    expect(state.status).toBe("error");
    expect(state.lastError).toContain("missing-program");
  });

  it("omits PI_CLI_PATH when Pi is not installed", async () => {
    resolvePiPathMock.mockReturnValue(null);
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const manager = new LocalThreadRuntimeManager();
    await manager.ensureThreadRuntime({
      threadId: "thread-2",
      worktreePath: "/tmp/repo",
      command: ["env", "ELECTRON_RUN_AS_NODE=1", "/bin/electron", "entry.js"],
    });

    const spawnEnv = spawnMock.mock.calls[0]?.[2]?.env as NodeJS.ProcessEnv;
    expect(spawnEnv.PATH).toBe("/enhanced/bin:/usr/bin");
    expect(spawnEnv.PI_CLI_PATH).toBeUndefined();
  });
});
