import { describe, expect, it, vi } from "vitest";
import { registerIpcHandlers } from "../../../apps/desktop/src/main/ipc-router";
import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type ShellSnapshot,
} from "../../../packages/shared/src";

describe("registerIpcHandlers", () => {
  it("binds shell and agent handlers to the expected invoke channels", async () => {
    const handlers = new Map<
      string,
      (event?: unknown, payload?: unknown) => Promise<unknown>
    >();
    const shellSnapshot: ShellSnapshot = {
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "41.0.1",
      platform: "darwin",
      mode: "test",
      runtime: {
        agentMode: "mock",
        electronVersion: "41.0.1",
        agentDirectory: "/tmp/pidesk/.pidesk-agent",
      },
      workspace: {
        rootPath: "/tmp/pidesk",
        agentDirectory: "/tmp/pidesk/.pidesk-agent",
        projects: [
          {
            id: "/tmp/pidesk",
            name: "pidesk",
            path: "/tmp/pidesk",
            isActive: true,
          },
        ],
      },
      catalog: {
        selection: {
          repositoryId: "/tmp/pidesk",
          worktreeId: "/tmp/pidesk",
          threadId: "default-thread",
        },
        repositories: [
          {
            id: "/tmp/pidesk",
            name: "pidesk",
            rootPath: "/tmp/pidesk",
            defaultBranch: "main",
            worktrees: [
              {
                id: "/tmp/pidesk",
                label: "main",
                path: "/tmp/pidesk",
                isMain: true,
                isDetached: false,
                git: {
                  status: "ready",
                  branch: "main",
                  commit: "abc1234",
                  hasChanges: false,
                  ahead: 0,
                  behind: 0,
                  stagedCount: 0,
                  modifiedCount: 0,
                  untrackedCount: 0,
                  message: null,
                },
                threads: [
                  {
                    id: "default-thread",
                    title: "Current thread",
                    isArchived: false,
                    lastActivityAt: null,
                    runtime: {
                      status: "ready",
                      lastError: null,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      capabilities: {
        supportsTurns: true,
        supportsTools: true,
        supportsActivity: true,
        supportsParallelSessions: false,
      },
    };
    const agentSnapshot: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };

    const getShellSnapshot = vi.fn(() => shellSnapshot);
    const agentHost = {
      getSnapshot: vi.fn(async () => agentSnapshot),
      prompt: vi.fn(async () => undefined),
      addRepository: vi.fn(async () => undefined),
      selectRepository: vi.fn(async () => undefined),
      createWorktree: vi.fn(async () => undefined),
      selectWorktree: vi.fn(async () => undefined),
      createThread: vi.fn(async () => undefined),
      selectThread: vi.fn(async () => undefined),
    };

    registerIpcHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, async (event, payload) => listener(event, payload));
      },
      getShellSnapshot,
      agentHost,
      mainWindow: null,
    });

    await expect(
      handlers.get(IPC_CHANNELS.shell.getSnapshot)?.(),
    ).resolves.toEqual(shellSnapshot);
    await expect(
      handlers.get(IPC_CHANNELS.agent.getSnapshot)?.(),
    ).resolves.toEqual(agentSnapshot);

    await handlers.get(IPC_CHANNELS.agent.prompt)?.(
      { sender: "electron-ipc-event" },
      { text: "Inspect the workspace" },
    );

    await handlers.get(IPC_CHANNELS.repositories.add)?.(
      { sender: "electron-ipc-event" },
      { path: "/tmp/pidesk" },
    );
    await handlers.get(IPC_CHANNELS.repositories.select)?.(
      { sender: "electron-ipc-event" },
      { repositoryId: "/tmp/pidesk" },
    );
    await handlers.get(IPC_CHANNELS.worktrees.create)?.(
      { sender: "electron-ipc-event" },
      {
        repositoryId: "/tmp/pidesk",
        branchName: "feature/runtime",
      },
    );
    await handlers.get(IPC_CHANNELS.worktrees.select)?.(
      { sender: "electron-ipc-event" },
      { worktreeId: "/tmp/pidesk-feature" },
    );
    await handlers.get(IPC_CHANNELS.threads.create)?.(
      { sender: "electron-ipc-event" },
      {
        worktreeId: "/tmp/pidesk-feature",
        title: "Investigate runtime",
      },
    );
    await handlers.get(IPC_CHANNELS.threads.select)?.(
      { sender: "electron-ipc-event" },
      { threadId: "thread-123" },
    );


    expect(getShellSnapshot).toHaveBeenCalledTimes(1);
    expect(agentHost.getSnapshot).toHaveBeenCalledTimes(1);
    expect(agentHost.prompt).toHaveBeenCalledWith("Inspect the workspace");
    expect(agentHost.addRepository).toHaveBeenCalledWith("/tmp/pidesk");
    expect(agentHost.selectRepository).toHaveBeenCalledWith("/tmp/pidesk");
    expect(agentHost.createWorktree).toHaveBeenCalledWith(
      "/tmp/pidesk",
      "feature/runtime",
    );
    expect(agentHost.selectWorktree).toHaveBeenCalledWith("/tmp/pidesk-feature");
    expect(agentHost.createThread).toHaveBeenCalledWith(
      "/tmp/pidesk-feature",
      "Investigate runtime",
    );
    expect(agentHost.selectThread).toHaveBeenCalledWith("thread-123");
  });
});
