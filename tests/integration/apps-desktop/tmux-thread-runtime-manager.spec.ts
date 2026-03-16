import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TmuxThreadRuntimeManager } from "../../../apps/desktop/src/main/tmux-thread-runtime-manager";
import { createTmuxThreadSessionName } from "../../../apps/desktop/src/main/tmux-session-naming";

const tempDirs: string[] = [];
const socketNames: string[] = [];

function createTempDir(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

function createSocketName(): string {
  const socketName = `pidesk-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  socketNames.push(socketName);
  return socketName;
}

function runTmux(socketName: string, args: string[]) {
  return spawnSync("tmux", ["-L", socketName, ...args], {
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const socketName of socketNames.splice(0)) {
    runTmux(socketName, ["kill-server"]);
  }

  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("TmuxThreadRuntimeManager", () => {
  it("creates, restarts, and terminates thread runtimes in isolated tmux sessions", async () => {
    const socketName = createSocketName();
    const worktreePath = createTempDir("pidesk-runtime-");
    const manager = new TmuxThreadRuntimeManager({ socketName });
    const launch = {
      threadId: "thread-alpha",
      worktreePath,
      command: ["sh", "-lc", "sleep 60"],
    };

    const created = await manager.ensureThreadRuntime(launch);

    expect(created).toMatchObject({
      threadId: "thread-alpha",
      sessionName: createTmuxThreadSessionName("thread-alpha"),
      worktreePath,
      status: "ready",
      lastError: null,
    });
    expect(runTmux(socketName, ["has-session", "-t", created.sessionName]).status).toBe(0);

    const restarted = await manager.restartThreadRuntime(launch);
    expect(restarted.sessionName).toBe(created.sessionName);
    expect(runTmux(socketName, ["has-session", "-t", restarted.sessionName]).status).toBe(0);

    await manager.terminateThreadRuntime("thread-alpha");
    expect(runTmux(socketName, ["has-session", "-t", restarted.sessionName]).status).not.toBe(0);

    const state = await manager.getRuntimeState({
      threadId: "thread-alpha",
      worktreePath,
    });
    expect(state).toMatchObject({
      threadId: "thread-alpha",
      sessionName: createTmuxThreadSessionName("thread-alpha"),
      worktreePath,
      status: "exited",
      lastError: null,
    });
  });

  it("reconciles missing threads and stale managed tmux sessions", async () => {
    const socketName = createSocketName();
    const worktreePath = createTempDir("pidesk-runtime-reconcile-");
    const manager = new TmuxThreadRuntimeManager({ socketName });

    await manager.ensureThreadRuntime({
      threadId: "thread-live",
      worktreePath,
      command: ["sh", "-lc", "sleep 60"],
    });

    const staleSessionName = createTmuxThreadSessionName("thread-stale");
    expect(
      runTmux(socketName, [
        "new-session",
        "-d",
        "-s",
        staleSessionName,
        "sh -lc 'sleep 60'",
      ]).status,
    ).toBe(0);

    const report = await manager.reconcile([
      {
        threadId: "thread-live",
        worktreePath,
      },
      {
        threadId: "thread-missing",
        worktreePath,
      },
    ]);

    expect(report.missingThreadIds).toEqual(["thread-missing"]);
    expect(report.staleSessionNames).toEqual([staleSessionName]);
    expect(report.active).toEqual([
      {
        threadId: "thread-live",
        sessionName: createTmuxThreadSessionName("thread-live"),
        worktreePath,
        status: "ready",
        lastError: null,
      },
      {
        threadId: "thread-missing",
        sessionName: createTmuxThreadSessionName("thread-missing"),
        worktreePath,
        status: "exited",
        lastError: null,
      },
    ]);
  });
  it("keeps existing runtimes usable when another thread fails to start", async () => {
    const socketName = createSocketName();
    const worktreePath = createTempDir("pidesk-runtime-stable-");
    const manager = new TmuxThreadRuntimeManager({ socketName });

    await manager.ensureThreadRuntime({
      threadId: "thread-live",
      worktreePath,
      command: ["sh", "-lc", "sleep 60"],
    });

    await expect(
      manager.ensureThreadRuntime({
        threadId: "thread-missing",
        worktreePath: path.join(worktreePath, "missing"),
        command: ["sh", "-lc", "sleep 60"],
      }),
    ).rejects.toThrow("missing worktree");

    await expect(
      manager.getRuntimeState({
        threadId: "thread-live",
        worktreePath,
      }),
    ).resolves.toMatchObject({
      threadId: "thread-live",
      status: "ready",
    });
  });


});
