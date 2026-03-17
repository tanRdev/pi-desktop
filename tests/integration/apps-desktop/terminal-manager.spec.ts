import { EventEmitter } from "node:events";
import type { BrowserWindow } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TerminalManager,
  type TerminalManagerDependencies,
} from "../../../apps/desktop/src/main/terminal-manager";
import { createTmuxThreadSessionName } from "../../../apps/desktop/src/main/tmux-session-naming";
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

function createSpawnSyncMock(tmuxAvailable: boolean) {
  return vi.fn((_program: string, args: string[]) => {
    if (args[0] === "-V") {
      return {
        status: tmuxAvailable ? 0 : 1,
        stdout: tmuxAvailable ? "tmux 3.4" : "",
        stderr: "",
        error: null,
      };
    }

    return {
      status: 0,
      stdout: "",
      stderr: "",
      error: null,
    };
  });
}

type TestSession = {
  status: string;
  lastActivityAt?: number;
};

type SpawnFn = NonNullable<TerminalManagerDependencies["spawn"]>;
type SpawnSyncFn = NonNullable<TerminalManagerDependencies["spawnSync"]>;
type PtyModule = NonNullable<TerminalManagerDependencies["ptyModule"]>;

function createTerminalManagerHarness({
  tmuxAvailable,
}: {
  tmuxAvailable: boolean;
}) {
  const ptyInstances: FakePty[] = [];
  const childProcesses: FakeChildProcess[] = [];
  const send = vi.fn<(channel: string, payload: unknown) => void>();
  const spawnSync = createSpawnSyncMock(tmuxAvailable);
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
    spawnSync: spawnSync as unknown as SpawnSyncFn,
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
    spawnSync,
    ptyInstances,
    childProcesses,
    ptySpawn,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("future terminal modules (RED)", () => {
  it("terminal-backends: resolveLocalShellProgram and buildTmuxLaunchSpec behaviors", async () => {
    const { resolveLocalShellProgram, buildTmuxLaunchSpec } = await import(
      "../../../apps/desktop/src/main/terminal/terminal-backends"
    );

    expect(resolveLocalShellProgram({ platform: "win32" })).toBe(
      "powershell.exe",
    );

    expect(
      resolveLocalShellProgram({ platform: "darwin", shell: "/bin/fish" }),
    ).toBe("/bin/fish");

    expect(resolveLocalShellProgram({ platform: "darwin" })).toBe("/bin/zsh");

    const lazySpec = buildTmuxLaunchSpec({
      id: "lazygit-1",
      backend: "lazygit",
      cwd: "/tmp/project",
      platform: "darwin",
    });

    expect(lazySpec.tmuxSessionName).toBeDefined();
    expect(lazySpec.createArgs).toEqual([
      "new-session",
      "-d",
      "-s",
      lazySpec.tmuxSessionName,
      "-c",
      "/tmp/project",
      "lazygit",
    ]);
    expect(lazySpec.attachCommand).toEqual({
      program: "tmux",
      args: ["attach", "-t", lazySpec.tmuxSessionName],
    });

    const linkedThreadId = "thread-42";
    const attachSpec = buildTmuxLaunchSpec({
      id: "tmux-attach-1",
      backend: "tmux-attach",
      cwd: "/tmp/project",
      linkedThreadId,
      platform: "darwin",
    });

    expect(attachSpec.createArgs.slice(-4)).toEqual([
      "tmux",
      "attach",
      "-t",
      createTmuxThreadSessionName(linkedThreadId),
    ]);

    expect(() =>
      buildTmuxLaunchSpec({
        id: "tmux-attach-2",
        backend: "tmux-attach",
        cwd: "/tmp/project",
        platform: "darwin",
      }),
    ).toThrow("tmux-attach backend requires linkedThreadId");
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
  it("falls back to local node-pty for 'shell' when tmux is unavailable", async () => {
    await import("../../../apps/desktop/src/main/ipc-router");

    const harness = createTerminalManagerHarness({ tmuxAvailable: false });
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

  it("creates tmux-backed session for 'lazygit' when tmux is available", async () => {
    const harness = createTerminalManagerHarness({ tmuxAvailable: true });
    const session = harness.manager.create("lazygit-terminal", {
      cols: 100,
      rows: 30,
      ownerWindowId: "terminal-lazygit",
      backend: "lazygit",
      cwd: "/tmp/project-beta",
    });

    const createCall = harness.spawnSync.mock.calls.find(
      (call: unknown[]) => call[1]?.[0] === "new-session",
    );

    expect(session.tmuxSessionName).toBeDefined();
    expect(createCall?.[1]).toEqual([
      "new-session",
      "-d",
      "-s",
      session.tmuxSessionName,
      "-c",
      "/tmp/project-beta",
      "lazygit",
    ]);
    expect(harness.ptySpawn).toHaveBeenCalledWith(
      "tmux",
      ["attach", "-t", session.tmuxSessionName],
      expect.objectContaining({
        cols: 100,
        rows: 30,
        cwd: "/tmp/project-beta",
      }),
    );
  });

  it("creates a tmux-attach wrapper session for the linked thread when tmux is available", async () => {
    const harness = createTerminalManagerHarness({ tmuxAvailable: true });
    const linkedThreadId = "thread-42";
    const session = harness.manager.create("tmux-attach-terminal", {
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-tmux-attach",
      backend: "tmux-attach",
      cwd: "/tmp/project-gamma",
      linkedThreadId,
    });

    const createCall = harness.spawnSync.mock.calls.find(
      (call: unknown[]) => call[1]?.[0] === "new-session",
    );

    expect(createCall?.[1]).toEqual([
      "new-session",
      "-d",
      "-s",
      session.tmuxSessionName,
      "-c",
      "/tmp/project-gamma",
      "tmux",
      "attach",
      "-t",
      createTmuxThreadSessionName(linkedThreadId),
    ]);
  });

  it("throws when creating tmux-only backend while tmux is unavailable", async () => {
    const harness = createTerminalManagerHarness({ tmuxAvailable: false });

    expect(() =>
      harness.manager.create("lazygit-without-tmux", {
        cols: 90,
        rows: 25,
        ownerWindowId: "terminal-lazygit-without-tmux",
        backend: "lazygit",
        cwd: "/tmp/project-delta",
      }),
    ).toThrow("Unsupported terminal backend without tmux: lazygit");
  });

  it("destroy() and destroyAll() remove sessions and attempt to kill tmux sessions", async () => {
    const harness = createTerminalManagerHarness({ tmuxAvailable: true });
    const first = harness.manager.create("destroy-one", {
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-destroy-one",
      backend: "lazygit",
      cwd: "/tmp/project-epsilon",
    });
    const second = harness.manager.create("destroy-two", {
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-destroy-two",
      backend: "lazygit",
      cwd: "/tmp/project-zeta",
    });

    harness.manager.destroy("destroy-one");

    const firstKillCall = harness.spawnSync.mock.calls.find(
      (call: unknown[]) =>
        call[1]?.[0] === "kill-session" &&
        call[1]?.[2] === first.tmuxSessionName,
    );

    expect(harness.ptyInstances[0]?.kill).toHaveBeenCalled();
    expect(firstKillCall?.[1]).toEqual([
      "kill-session",
      "-t",
      first.tmuxSessionName,
    ]);
    expect(harness.manager.get("destroy-one")).toBeUndefined();

    harness.manager.destroyAll();

    const secondKillCall = harness.spawnSync.mock.calls.find(
      (call: unknown[]) =>
        call[1]?.[0] === "kill-session" &&
        call[1]?.[2] === second.tmuxSessionName,
    );

    expect(harness.ptyInstances[1]?.kill).toHaveBeenCalled();
    expect(secondKillCall?.[1]).toEqual([
      "kill-session",
      "-t",
      second.tmuxSessionName,
    ]);
    expect(harness.manager.getSessions()).toEqual([]);
  });

  it("resize() is a no-op for missing sessions", async () => {
    const harness = createTerminalManagerHarness({ tmuxAvailable: true });

    expect(() =>
      harness.manager.resize("missing-terminal", 132, 48),
    ).not.toThrow();
    expect(
      harness.spawnSync.mock.calls.find(
        (call: unknown[]) => call[1]?.[0] === "resize-window",
      ),
    ).toBeUndefined();
  });

  it("REGRESSION: tmux-backed pty exit should also remove tmux session", async () => {
    const harness = createTerminalManagerHarness({ tmuxAvailable: true });
    const session = harness.manager.create("tmux-exit-cleanup", {
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-tmux-exit-cleanup",
      backend: "lazygit",
      cwd: "/tmp/project-theta",
    });

    harness.spawnSync.mockClear();
    harness.ptyInstances[0]?.emitExit(0);

    const killCall = harness.spawnSync.mock.calls.find(
      (call: unknown[]) => call[1]?.[0] === "kill-session",
    );

    expect(harness.manager.get("tmux-exit-cleanup")).toBeUndefined();
    expect(killCall?.[1]).toEqual([
      "kill-session",
      "-t",
      session.tmuxSessionName,
    ]);
  });
});
