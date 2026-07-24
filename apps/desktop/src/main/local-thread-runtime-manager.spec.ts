import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const resolvePiPathMock = vi.fn(() => null as string | null);
const buildEnhancedPathMock = vi.fn(() => "/enhanced/bin:/usr/bin");

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

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
