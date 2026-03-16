import { describe, expect, it, vi } from "vitest";
import { registerIpcHandlers } from "../../../apps/desktop/src/main/ipc-router";
import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type PiDiscoveryResult,
  type PiTerminalRouteResult,
  type SearchResponse,
  type ShellSnapshot,
} from "../../../packages/shared/src";

function createShellSnapshot(): ShellSnapshot {
  return {
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
}

function createAgentSnapshot(): AgentSnapshot {
  return {
    sessionId: "mock-session",
    status: "ready",
    messages: [],
    lastError: null,
  };
}

function createHandlerHarness() {
  const handlers = new Map<
    string,
    (event?: unknown, payload?: unknown) => Promise<unknown>
  >();

  return {
    handlers,
    handle: (
      channel: string,
      listener: (
        event?: unknown,
        payload?: unknown,
      ) => Promise<unknown> | unknown,
    ) => {
      handlers.set(channel, async (event, payload) => listener(event, payload));
    },
  };
}

function createAgentHost(agentSnapshot: AgentSnapshot) {
  return {
    getProviders: vi.fn(async () => []),
    getSettings: vi.fn(async () => ({})),
    getSnapshot: vi.fn(async () => agentSnapshot),
    prompt: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    addRepository: vi.fn(async () => undefined),
    selectRepository: vi.fn(async () => undefined),
    createWorktree: vi.fn(async () => undefined),
    selectWorktree: vi.fn(async () => undefined),
    createThread: vi.fn(async () => undefined),
    selectThread: vi.fn(async () => undefined),
  };
}

describe("registerIpcHandlers", () => {
  it("binds shell and agent handlers to the expected invoke channels", async () => {
    const shellSnapshot = createShellSnapshot();
    const agentSnapshot = createAgentSnapshot();
    const harness = createHandlerHarness();
    const getShellSnapshot = vi.fn(() => shellSnapshot);
    const agentHost = createAgentHost(agentSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      agentHost,
      mainWindow: null,
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.shell.getSnapshot)?.(),
    ).resolves.toEqual(shellSnapshot);
    await expect(
      harness.handlers.get(IPC_CHANNELS.agent.getSnapshot)?.(),
    ).resolves.toEqual(agentSnapshot);

    await harness.handlers.get(IPC_CHANNELS.agent.prompt)?.(
      { sender: "electron-ipc-event" },
      { text: "Inspect the workspace" },
    );
    await harness.handlers.get(IPC_CHANNELS.repositories.add)?.(
      { sender: "electron-ipc-event" },
      { path: "/tmp/pidesk" },
    );
    await harness.handlers.get(IPC_CHANNELS.repositories.select)?.(
      { sender: "electron-ipc-event" },
      { repositoryId: "/tmp/pidesk" },
    );
    await harness.handlers.get(IPC_CHANNELS.worktrees.create)?.(
      { sender: "electron-ipc-event" },
      {
        repositoryId: "/tmp/pidesk",
        branchName: "feature/runtime",
      },
    );
    await harness.handlers.get(IPC_CHANNELS.worktrees.select)?.(
      { sender: "electron-ipc-event" },
      { worktreeId: "/tmp/pidesk-feature" },
    );
    await harness.handlers.get(IPC_CHANNELS.threads.create)?.(
      { sender: "electron-ipc-event" },
      {
        worktreeId: "/tmp/pidesk-feature",
        title: "Investigate runtime",
      },
    );
    await harness.handlers.get(IPC_CHANNELS.threads.select)?.(
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
    expect(agentHost.selectWorktree).toHaveBeenCalledWith(
      "/tmp/pidesk-feature",
    );
    expect(agentHost.createThread).toHaveBeenCalledWith(
      "/tmp/pidesk-feature",
      "Investigate runtime",
    );
    expect(agentHost.selectThread).toHaveBeenCalledWith("thread-123");
  });

  it("binds terminal.create and getSessions handlers returning full TerminalSession descriptors", async () => {
    const harness = createHandlerHarness();
    const fakeSession = {
      id: "term-1",
      backend: "shell",
      cwd: "/tmp",
      status: "ready",
      ownerWindowId: "terminal-term-1",
      createdAt: Date.now(),
    };
    const tmMock = {
      setMainWindow: vi.fn(),
      initialize: vi.fn(),
      isAvailable: vi.fn(() => true),
      getError: vi.fn(() => null),
      create: vi.fn(() => fakeSession),
      getSessions: vi.fn(() => [fakeSession]),
      write: vi.fn(),
      resize: vi.fn(),
      destroy: vi.fn(),
      get: vi.fn(),
    };

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
    });

    const createPayload = {
      id: "term-1",
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-term-1",
    };

    await expect(
      harness.handlers.get(IPC_CHANNELS.terminal.create)?.(
        undefined,
        createPayload,
      ),
    ).resolves.toEqual(fakeSession);
    await expect(
      harness.handlers.get(IPC_CHANNELS.terminal.getSessions)?.(),
    ).resolves.toEqual([fakeSession]);
    expect(tmMock.create).toHaveBeenCalledWith("term-1", createPayload);
  });

  it("delegates discovery, slash suggestions, search, model switch, and terminal routing", async () => {
    const harness = createHandlerHarness();
    const discovery: PiDiscoveryResult = {
      isInstalled: true,
      globalAgentDir: "/tmp/.pi/agent",
      skills: [{ name: "brainstorming", description: "Explore ideas" }],
      commands: [{ name: "deploy", description: "Deploy app" }],
    };
    const slashSuggestions = {
      kind: "slash" as const,
      suggestions: [
        {
          kind: "command" as const,
          name: "deploy",
          slash: "/deploy",
          description: "Deploy app",
        },
      ],
      hasMore: false,
    };
    const searchResponse: SearchResponse = {
      query: "app",
      results: [
        {
          path: "/tmp/pidesk/apps/desktop/src/renderer/src/app.tsx",
          name: "app.tsx",
          score: 100,
          type: "file",
        },
      ],
      total: 1,
      duration: 4,
    };
    const routeResult: PiTerminalRouteResult = {
      success: true,
      threadId: "thread-123",
    };

    const switchModel = vi.fn(async () => undefined);
    const getDiscovery = vi.fn(async () => discovery);
    const getSlashSuggestions = vi.fn(async () => slashSuggestions);
    const searchFiles = vi.fn(async () => searchResponse);
    const routeToTerminal = vi.fn(async () => routeResult);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      switchModel,
      getDiscovery,
      getSlashSuggestions,
      searchFiles,
      routeToTerminal,
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.agent.getDiscovery)?.(),
    ).resolves.toEqual(discovery);
    await expect(
      harness.handlers.get(IPC_CHANNELS.agent.getSlashSuggestions)?.(
        undefined,
        {
          text: "/dep",
          cursorPosition: 4,
          trigger: "/",
          query: "dep",
        },
      ),
    ).resolves.toEqual(slashSuggestions);
    await expect(
      harness.handlers.get(IPC_CHANNELS.search.searchFiles)?.(undefined, {
        query: "app",
        rootPath: "/tmp/pidesk",
      }),
    ).resolves.toEqual(searchResponse);
    await expect(
      harness.handlers.get(IPC_CHANNELS.threads.routeToTerminal)?.(undefined, {
        terminalId: "term-1",
        prompt: "echo hello",
        startPiIfNotLinked: true,
      }),
    ).resolves.toEqual(routeResult);

    await harness.handlers.get(IPC_CHANNELS.agent.switchModel)?.(undefined, {
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });

    expect(getDiscovery).toHaveBeenCalledTimes(1);
    expect(getSlashSuggestions).toHaveBeenCalledWith({
      text: "/dep",
      cursorPosition: 4,
      trigger: "/",
      query: "dep",
    });
    expect(searchFiles).toHaveBeenCalledWith({
      query: "app",
      rootPath: "/tmp/pidesk",
    });
    expect(routeToTerminal).toHaveBeenCalledWith({
      terminalId: "term-1",
      prompt: "echo hello",
      startPiIfNotLinked: true,
    });
    expect(switchModel).toHaveBeenCalledWith({
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });
  });
});
