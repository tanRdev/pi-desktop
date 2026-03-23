import { EventEmitter } from "node:events";
import type { BrowserWindow } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TerminalManager,
  type TerminalManagerDependencies,
} from "../../../apps/desktop/src/main/terminal-manager";
import { IPC_CHANNELS } from "../../../packages/shared/src";

class FakePty {
  public readonly write = vi.fn<(data: string) => void>();
  public readonly resize = vi.fn<(cols: number, rows: number) => void>();
  public readonly kill = vi.fn<() => void>();

  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly exitListeners = new Set<
    (event: { exitCode: number }) => void
  >();

  constructor(
    public readonly program: string,
    public readonly args: string[],
    public readonly options: Record<string, unknown>,
  ) {}

  onData(listener: (data: string) => void): void {
    this.dataListeners.add(listener);
  }

  onExit(listener: (event: { exitCode: number }) => void): void {
    this.exitListeners.add(listener);
  }

  emitExit(exitCode: number): void {
    for (const listener of this.exitListeners) {
      listener({ exitCode });
    }
  }

  emitData(data: string): void {
    for (const listener of this.dataListeners) {
      listener(data);
    }
  }
}

class FakeChildProcess extends EventEmitter {
  public readonly stdout = new EventEmitter();
  public readonly stderr = new EventEmitter();
  public readonly stdin = {
    destroyed: false,
    write: vi.fn<(data: string) => void>(),
  };
  public readonly kill = vi.fn<() => void>();

  constructor(
    public readonly program: string,
    public readonly args: string[],
    public readonly options: Record<string, unknown>,
  ) {
    super();
  }
}

type TestSession = {
  status: string;
  lastActivityAt?: number;
};

type SpawnFn = NonNullable<TerminalManagerDependencies["spawn"]>;
type PtyModule = NonNullable<TerminalManagerDependencies["ptyModule"]>;

function createTerminalManagerHarness() {
  const ptyInstances: FakePty[] = [];
  const childProcesses: FakeChildProcess[] = [];
  const send = vi.fn<(channel: string, payload: unknown) => void>();
  const spawn = vi.fn(
    (program: string, args: string[], options: Record<string, unknown>) => {
      const child = new FakeChildProcess(program, args, options);
      childProcesses.push(child);
      return child;
    },
  );
  const ptySpawn = vi.fn(
    (program: string, args: string[], options: Record<string, unknown>) => {
      const pty = new FakePty(program, args, options);
      ptyInstances.push(pty);
      return pty;
    },
  );

  const manager = new TerminalManager({
    spawn: spawn as unknown as SpawnFn,
    ptyModule: {
      spawn: ptySpawn as unknown as PtyModule["spawn"],
    } as PtyModule,
    env: process.env,
    platform: process.platform,
    cwd: () => process.cwd(),
    now: Date.now,
  });

  manager.setMainWindow({ webContents: { send } } as unknown as BrowserWindow);
  manager.initialize();

  return {
    manager,
    send,
    spawn,
    ptyInstances,
    childProcesses,
    ptySpawn,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("future terminal modules (RED)", () => {
  it("terminal-backends: resolveLocalShellProgram behaviors", async () => {
    const { resolveLocalShellProgram } = await import(
      "../../../apps/desktop/src/main/terminal/terminal-backends"
    );

    expect(resolveLocalShellProgram({ platform: "win32" })).toBe(
      "powershell.exe",
    );

    expect(
      resolveLocalShellProgram({ platform: "darwin", shell: "/bin/fish" }),
    ).toBe("/bin/fish");

    expect(resolveLocalShellProgram({ platform: "darwin" })).toBe("/bin/zsh");
  });

  it("removes tmux launch helpers from terminal backends", async () => {
    const terminalBackendSource = await import(
      "../../../apps/desktop/src/main/terminal/terminal-backends"
    );

    expect("buildTmuxLaunchSpec" in terminalBackendSource).toBe(false);
    expect("isTmuxLaunchBackend" in terminalBackendSource).toBe(false);
  });

  it("terminal-session-events: bindPtySessionEvents and bindChildProcessSessionEvents forward events", async () => {
    const { bindPtySessionEvents, bindChildProcessSessionEvents } =
      await import(
        "../../../apps/desktop/src/main/terminal/terminal-session-events"
      );

    const send = vi.fn<(channel: string, payload: unknown) => void>();
    const pty = new FakePty("prog", [], {});
    const session: TestSession = { status: "starting" };
    const onExit = vi.fn<(code: number) => void>();

    bindPtySessionEvents({
      pty,
      session,
      id: "pty-1",
      mainWindow: { webContents: { send } },
      onExit,
    });

    const before = Date.now();
    pty.emitData("hello");

    expect(session.status).toBe("ready");
    expect(typeof session.lastActivityAt).toBe("number");
    expect(session.lastActivityAt).toBeGreaterThanOrEqual(before);

    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.terminal.create, {
      type: "data",
      id: "pty-1",
      data: "hello",
    });

    pty.emitExit(5);
    expect(session.status).toBe("exited");
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.terminal.create, {
      type: "exit",
      id: "pty-1",
      exitCode: 5,
    });
    expect(onExit).toHaveBeenCalledWith(5);

    // child process
    const child = new FakeChildProcess("prog", [], {});
    const childSession: TestSession = { status: "starting" };
    const childOnExit = vi.fn<(code: number) => void>();
    bindChildProcessSessionEvents({
      child,
      session: childSession,
      id: "child-1",
      mainWindow: { webContents: { send } },
      onExit: childOnExit,
    });

    const beforeChild = Date.now();
    child.stdout.emit("data", "out1");
    expect(childSession.lastActivityAt).toBeGreaterThanOrEqual(beforeChild);
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.terminal.create, {
      type: "data",
      id: "child-1",
      data: "out1",
    });

    child.stderr.emit("data", "err1");
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.terminal.create, {
      type: "data",
      id: "child-1",
      data: "err1",
    });

    child.emit("exit", null);
    expect(childSession.status).toBe("exited");
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.terminal.create, {
      type: "exit",
      id: "child-1",
      exitCode: 0,
    });
    expect(childOnExit).toHaveBeenCalledWith(0);
  });
});

describe("terminalManager", () => {
  it("creates local node-pty sessions for shell backends", async () => {
    await import("../../../apps/desktop/src/main/ipc-router");

    const harness = createTerminalManagerHarness();
    const expectedShell =
      process.platform === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/zsh";

    const session = harness.manager.create("shell-local", {
      cols: 120,
      rows: 40,
      ownerWindowId: "terminal-shell-local",
      backend: "shell",
      cwd: "/tmp/project-alpha",
    });

    expect(session).toMatchObject({
      id: "shell-local",
      backend: "shell",
      cwd: "/tmp/project-alpha",
      ownerWindowId: "terminal-shell-local",
      status: "ready",
    });
    expect(harness.ptySpawn).toHaveBeenCalledWith(
      expectedShell,
      [],
      expect.objectContaining({
        cols: 120,
        rows: 40,
        cwd: "/tmp/project-alpha",
      }),
    );

    harness.ptyInstances[0]?.emitExit(7);

    expect(harness.manager.get("shell-local")).toBeUndefined();
    expect(harness.send).toHaveBeenCalledWith(IPC_CHANNELS.terminal.create, {
      type: "exit",
      id: "shell-local",
      exitCode: 7,
    });
  });

  it("creates local lazygit sessions", async () => {
    const harness = createTerminalManagerHarness();
    const session = harness.manager.create("lazygit-terminal", {
      cols: 100,
      rows: 30,
      ownerWindowId: "terminal-lazygit",
      backend: "lazygit",
      cwd: "/tmp/project-beta",
    });

    expect(session).toMatchObject({
      id: "lazygit-terminal",
      backend: "lazygit",
      cwd: "/tmp/project-beta",
      status: "ready",
    });
    expect(harness.ptySpawn).toHaveBeenCalledWith(
      "lazygit",
      [],
      expect.objectContaining({
        cols: 100,
        rows: 30,
        cwd: "/tmp/project-beta",
      }),
    );
  });

  it("falls back to child_process when node-pty is unavailable", () => {
    const send = vi.fn<(channel: string, payload: unknown) => void>();
    const spawn = vi.fn(
      (program: string, args: string[], options: Record<string, unknown>) => {
        return new FakeChildProcess(program, args, options);
      },
    );
    const manager = new TerminalManager({
      spawn: spawn as unknown as SpawnFn,
      nodeRequire: Object.assign(
        () => {
          throw new Error("node-pty unavailable");
        },
        {
          cache: {} as NodeJS.Dict<NodeModule>,
          extensions: {} as NodeJS.RequireExtensions,
          main: undefined as NodeModule | undefined,
          resolve: () => "node-pty",
        },
      ) as unknown as NonNullable<TerminalManagerDependencies["nodeRequire"]>,
      env: process.env,
      platform: process.platform,
      cwd: () => process.cwd(),
      now: Date.now,
    });

    manager.setMainWindow({
      webContents: { send },
    } as unknown as BrowserWindow);
    manager.initialize();

    const session = manager.create("fallback-shell", {
      cols: 90,
      rows: 25,
      ownerWindowId: "terminal-fallback-shell",
      backend: "shell",
      cwd: "/tmp/project-delta",
    });

    expect(session.status).toBe("ready");
    expect(spawn).toHaveBeenCalledWith(
      process.platform === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/zsh",
      [],
      expect.objectContaining({ cwd: "/tmp/project-delta" }),
    );
  });

  it("destroy() and destroyAll() remove local sessions", async () => {
    const harness = createTerminalManagerHarness();
    harness.manager.create("destroy-one", {
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-destroy-one",
      backend: "lazygit",
      cwd: "/tmp/project-epsilon",
    });
    harness.manager.create("destroy-two", {
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-destroy-two",
      backend: "lazygit",
      cwd: "/tmp/project-zeta",
    });

    harness.manager.destroy("destroy-one");

    expect(harness.ptyInstances[0]?.kill).toHaveBeenCalled();
    expect(harness.manager.get("destroy-one")).toBeUndefined();

    harness.manager.destroyAll();

    expect(harness.ptyInstances[1]?.kill).toHaveBeenCalled();
    expect(harness.manager.getSessions()).toEqual([]);
  });

  it("resize() is a no-op for missing sessions", async () => {
    const harness = createTerminalManagerHarness();

    expect(() =>
      harness.manager.resize("missing-terminal", 132, 48),
    ).not.toThrow();
  });
});
