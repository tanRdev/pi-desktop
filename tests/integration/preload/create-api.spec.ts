import { describe, expect, it, vi } from "vitest";
import {
  createPiDeskApi,
  type PreloadInvoke,
  type PreloadOn,
} from "../../../apps/desktop/src/preload/api";
import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type PiDeskAgentEvent,
  type ShellSnapshot,
} from "../../../packages/shared/src";

describe("createPiDeskApi", () => {
  it("invokes typed shell and agent channels", async () => {
    const shellSnapshot: ShellSnapshot = {
      appName: "PiDesk",
      appVersion: "0.1.0",
      platform: "darwin",
      chromeVersion: "41.0.1",
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

    const invokeCalls: Array<[string, unknown?]> = [];
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);

      if (channel === IPC_CHANNELS.shell.getSnapshot) {
        return shellSnapshot as TReturn;
      }

      if (channel === IPC_CHANNELS.agent.getSnapshot) {
        return agentSnapshot as TReturn;
      }

      return undefined as TReturn;
    };

    const api = createPiDeskApi({
      invoke,
      on: () => () => undefined,
    });

    await expect(api.shell.getSnapshot()).resolves.toEqual(shellSnapshot);
    await expect(api.agent.getSnapshot()).resolves.toEqual(agentSnapshot);

    expect(invokeCalls[0]).toEqual([IPC_CHANNELS.shell.getSnapshot, undefined]);
    expect(invokeCalls[1]).toEqual([IPC_CHANNELS.agent.getSnapshot, undefined]);
  });

  it("subscribes to agent events and returns an unsubscribe callback", () => {
    const event: PiDeskAgentEvent = {
      type: "message_update",
      messageId: "assistant-1",
      role: "assistant",
      text: "Streaming reply",
      delta: "reply",
      timestamp: 1,
    };

    const listener = vi.fn();
    const off = vi.fn();
    const on: PreloadOn = <TPayload>(
      channel: string,
      callback: (payload: TPayload) => void,
    ) => {
      expect(channel).toBe(IPC_CHANNELS.agent.event);
      callback(event as TPayload);
      return off;
    };

    const invoke: PreloadInvoke = async <TReturn>() => undefined as TReturn;

    const api = createPiDeskApi({
      invoke,
      on,
    });

    const unsubscribe = api.agent.subscribe(listener);

    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();

    expect(off).toHaveBeenCalledTimes(1);
  });

  it("sends prompts over the agent prompt channel", async () => {
    const invokeCalls: Array<[string, unknown?]> = [];
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);
      return undefined as TReturn;
    };

    const api = createPiDeskApi({
      invoke,
      on: () => () => undefined,
    });

    await api.agent.prompt("Summarize the current repository state");

    expect(invokeCalls[0]).toEqual([
      IPC_CHANNELS.agent.prompt,
      {
        text: "Summarize the current repository state",
      },
    ]);
  });

  it("invokes repository, worktree, and thread navigation channels", async () => {
    const invokeCalls: Array<[string, unknown?]> = [];
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);
      return undefined as TReturn;
    };

    const api = createPiDeskApi({
      invoke,
      on: () => () => undefined,
    });

    await api.repositories.add("/tmp/work/repo-one");
    await api.repositories.select("/tmp/work/repo-one");
    await api.worktrees.create("/tmp/work/repo-one", "feature/runtime");
    await api.worktrees.select("/tmp/work/repo-one-feature");
    await api.threads.create("/tmp/work/repo-one-feature", "Investigate runtime");
    await api.threads.select("thread-123");

    expect(invokeCalls).toEqual([
      [IPC_CHANNELS.repositories.add, { path: "/tmp/work/repo-one" }],
      [IPC_CHANNELS.repositories.select, { repositoryId: "/tmp/work/repo-one" }],
      [
        IPC_CHANNELS.worktrees.create,
        {
          repositoryId: "/tmp/work/repo-one",
          branchName: "feature/runtime",
        },
      ],
      [IPC_CHANNELS.worktrees.select, { worktreeId: "/tmp/work/repo-one-feature" }],
      [
        IPC_CHANNELS.threads.create,
        {
          worktreeId: "/tmp/work/repo-one-feature",
          title: "Investigate runtime",
        },
      ],
      [IPC_CHANNELS.threads.select, { threadId: "thread-123" }],
    ]);
  });
});
