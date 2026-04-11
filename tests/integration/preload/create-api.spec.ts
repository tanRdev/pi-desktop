import { describe, expect, it, vi } from "vitest";
import {
  type CreatePiDeskApiDependencies,
  createPiDeskApi,
  type PreloadInvoke,
  type PreloadOn,
} from "../../../apps/desktop/src/preload/api";
import {
  type AgentSnapshot,
  createEmptyWorkspaceSession,
  IPC_CHANNELS,
  type PackageManagerStatus,
  type PiDeskAgentEvent,
  type RepositoryPreferences,
  type ShellSnapshot,
} from "../../../packages/shared/src";
import type { AppPreferences } from "../../../packages/shared/src/models/workspace-session";

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

    const api: ReturnType<typeof createPiDeskApi> = createPiDeskApi({
      invoke,
      on: () => () => undefined,
    } satisfies CreatePiDeskApiDependencies);

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
      if (channel === IPC_CHANNELS.threads.create) {
        return "thread-created" as TReturn;
      }
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

  it("sends prompt cancellation over the dedicated agent cancel channel", async () => {
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

    await api.agent.cancelPrompt();

    expect(invokeCalls[0]).toEqual([
      IPC_CHANNELS.agent.cancelPrompt,
      undefined,
    ]);
  });

  it("invokes repository, worktree, and thread navigation channels", async () => {
    const invokeCalls: Array<[string, unknown?]> = [];
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);
      if (channel === IPC_CHANNELS.threads.create) {
        return "thread-created" as TReturn;
      }
      return undefined as TReturn;
    };

    const api = createPiDeskApi({
      invoke,
      on: () => () => undefined,
    });

    await api.repositories.add("/tmp/work/repo-one");
    await api.repositories.select("/tmp/work/repo-one");
    await api.repositories.reorder([
      "/tmp/work/repo-two",
      "/tmp/work/repo-one",
    ]);
    await Reflect.get(api.repositories, "openInFinder")("/tmp/work/repo-one");
    await Reflect.get(api.repositories, "remove")("/tmp/work/repo-one");
    await api.worktrees.create("/tmp/work/repo-one", "feature/runtime");
    await api.worktrees.select("/tmp/work/repo-one-feature");
    await expect(
      api.threads.create("/tmp/work/repo-one-feature", "Investigate runtime"),
    ).resolves.toBe("thread-created");
    await api.threads.select("thread-123");

    expect(invokeCalls).toEqual([
      [IPC_CHANNELS.repositories.add, { path: "/tmp/work/repo-one" }],
      [
        IPC_CHANNELS.repositories.select,
        { repositoryId: "/tmp/work/repo-one" },
      ],
      [
        IPC_CHANNELS.repositories.reorder,
        {
          repositoryIds: ["/tmp/work/repo-two", "/tmp/work/repo-one"],
        },
      ],
      [
        IPC_CHANNELS.repositories.openInFinder,
        { repositoryId: "/tmp/work/repo-one" },
      ],
      [
        IPC_CHANNELS.repositories.remove,
        { repositoryId: "/tmp/work/repo-one" },
      ],
      [
        IPC_CHANNELS.worktrees.create,
        {
          repositoryId: "/tmp/work/repo-one",
          branchName: "feature/runtime",
        },
      ],
      [
        IPC_CHANNELS.worktrees.select,
        { worktreeId: "/tmp/work/repo-one-feature" },
      ],
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

  it("invokes state persistence channels", async () => {
    const repositoryPreferences: RepositoryPreferences = {
      repositoryId: "/tmp/work/repo-one",
      customName: "Repo One",
      icon: "rocket",
      accentColor: "#2255aa",
    };
    const workspaceSession = createEmptyWorkspaceSession(
      "/tmp/work/repo-one/feature",
    );
    const appPreferences: AppPreferences = {
      leftSidebarWidth: 240,
      settings: {
        interface: {
          theme: "dark",
        },
      },
    };
    const invokeCalls: Array<[string, unknown?]> = [];
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);

      if (channel === IPC_CHANNELS.state.getRepositoryPreferences) {
        return repositoryPreferences as TReturn;
      }
      if (channel === IPC_CHANNELS.state.getWorkspaceSession) {
        return workspaceSession as TReturn;
      }
      if (channel === IPC_CHANNELS.state.getAppPreferences) {
        return appPreferences as TReturn;
      }

      return undefined as TReturn;
    };

    const api = createPiDeskApi({
      invoke,
      on: () => () => undefined,
    });

    await expect(
      api.state.getRepositoryPreferences("/tmp/work/repo-one"),
    ).resolves.toEqual(repositoryPreferences);
    await api.state.updateRepositoryPreferences("/tmp/work/repo-one", {
      customName: "Repo One",
      icon: "rocket",
      accentColor: "#2255aa",
    });
    await expect(
      api.state.getWorkspaceSession("/tmp/work/repo-one/feature"),
    ).resolves.toEqual(workspaceSession);
    await api.state.saveWorkspaceSession(workspaceSession);
    await expect(api.state.getAppPreferences()).resolves.toEqual(
      appPreferences,
    );
    await api.state.updateAppPreferences({
      leftSidebarWidth: 240,
      settings: {
        interface: {
          theme: "dark",
        },
      },
    });
    await api.state.importLegacyPreferences({
      leftSidebarWidth: 240,
      repositories: [
        {
          repositoryId: "/tmp/work/repo-one",
          customName: "Repo One",
        },
      ],
    });
    await api.git.getRepositoryStatus("/tmp/work/repo-one");
    await api.git.stageFile("/tmp/work/repo-one", "src/app.ts");
    await api.git.unstageFile("/tmp/work/repo-one", "src/app.ts");
    await api.git.discardFile("/tmp/work/repo-one", "src/app.ts");
    await api.git.commit("/tmp/work/repo-one", "feat: native git panel");
    await api.git.pull("/tmp/work/repo-one");
    await api.git.push("/tmp/work/repo-one");

    expect(invokeCalls).toEqual([
      [
        IPC_CHANNELS.state.getRepositoryPreferences,
        { repositoryId: "/tmp/work/repo-one" },
      ],
      [
        IPC_CHANNELS.state.updateRepositoryPreferences,
        {
          repositoryId: "/tmp/work/repo-one",
          updates: {
            customName: "Repo One",
            icon: "rocket",
            accentColor: "#2255aa",
          },
        },
      ],
      [
        IPC_CHANNELS.state.getWorkspaceSession,
        { worktreeId: "/tmp/work/repo-one/feature" },
      ],
      [IPC_CHANNELS.state.saveWorkspaceSession, { session: workspaceSession }],
      [IPC_CHANNELS.state.getAppPreferences, undefined],
      [
        IPC_CHANNELS.state.updateAppPreferences,
        {
          updates: {
            leftSidebarWidth: 240,
            settings: {
              interface: {
                theme: "dark",
              },
            },
          },
        },
      ],
      [
        IPC_CHANNELS.state.importLegacyPreferences,
        {
          importData: {
            leftSidebarWidth: 240,
            repositories: [
              {
                repositoryId: "/tmp/work/repo-one",
                customName: "Repo One",
              },
            ],
          },
        },
      ],
      [
        IPC_CHANNELS.git.getRepositoryStatus,
        { repositoryPath: "/tmp/work/repo-one" },
      ],
      [
        IPC_CHANNELS.git.stageFile,
        { repositoryPath: "/tmp/work/repo-one", filePath: "src/app.ts" },
      ],
      [
        IPC_CHANNELS.git.unstageFile,
        { repositoryPath: "/tmp/work/repo-one", filePath: "src/app.ts" },
      ],
      [
        IPC_CHANNELS.git.discardFile,
        { repositoryPath: "/tmp/work/repo-one", filePath: "src/app.ts" },
      ],
      [
        IPC_CHANNELS.git.commit,
        {
          repositoryPath: "/tmp/work/repo-one",
          message: "feat: native git panel",
        },
      ],
      [IPC_CHANNELS.git.pull, { repositoryPath: "/tmp/work/repo-one" }],
      [IPC_CHANNELS.git.push, { repositoryPath: "/tmp/work/repo-one" }],
    ]);
  });

  it("invokes package catalog, install, and subscription channels", async () => {
    const managerStatus: PackageManagerStatus = {
      cli: "available",
      network: "available",
      authenticated: true,
      message: null,
    };
    const invokeCalls: Array<[string, unknown?]> = [];
    const off = vi.fn();
    const listener = vi.fn();
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);

      if (channel === IPC_CHANNELS.packages.getManagerStatus) {
        return managerStatus as TReturn;
      }

      return undefined as TReturn;
    };
    const on: PreloadOn = <TPayload>(
      channel: string,
      callback: (payload: TPayload) => void,
    ) => {
      expect(channel).toBe(IPC_CHANNELS.packages.event);
      callback({
        type: "operation_updated",
        operation: {
          id: "operation-1",
          packageName: "@acme/pi-tools",
          scope: "local",
          kind: "install",
          status: "running",
          message: "Installing package",
          output: [],
        },
      } as TPayload);
      return off;
    };

    const api = createPiDeskApi({ invoke, on });

    await expect(api.packages.getManagerStatus()).resolves.toEqual(
      managerStatus,
    );
    await api.packages.searchCatalog({
      query: "search",
      sort: "downloads",
      kinds: ["extension"],
      hasDemoOnly: true,
    });
    await api.packages.getPackageDetail("@acme/pi-tools");
    await api.packages.listInstalled("local");
    await api.packages.install({
      packageName: "@acme/pi-tools",
      scope: "local",
    });
    await api.packages.remove({
      packageName: "@acme/pi-tools",
      scope: "global",
    });
    await api.packages.update({ scope: "global" });
    const unsubscribe = api.packages.subscribe(listener);
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledTimes(1);
    expect(invokeCalls).toEqual([
      [IPC_CHANNELS.packages.getManagerStatus, undefined],
      [
        IPC_CHANNELS.packages.searchCatalog,
        {
          query: "search",
          sort: "downloads",
          kinds: ["extension"],
          hasDemoOnly: true,
        },
      ],
      [
        IPC_CHANNELS.packages.getPackageDetail,
        { packageName: "@acme/pi-tools" },
      ],
      [IPC_CHANNELS.packages.listInstalled, { scope: "local" }],
      [
        IPC_CHANNELS.packages.install,
        { packageName: "@acme/pi-tools", scope: "local" },
      ],
      [
        IPC_CHANNELS.packages.remove,
        { packageName: "@acme/pi-tools", scope: "global" },
      ],
      [IPC_CHANNELS.packages.update, { scope: "global" }],
    ]);
  });
});
