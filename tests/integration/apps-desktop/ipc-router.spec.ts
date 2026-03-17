import { describe, expect, it, vi } from "vitest";

// Mock `node:fs` early so modules imported below that may use it will get the mocked
// version. Tests will assert the spy was *not* called for out-of-workspace requests.
// Expose stable spies so individual tests can customize implementations.
vi.mock("node:fs", () => {
  const readdirSync = vi.fn(() => {
    throw new Error("node:fs.readdirSync should not be called during tests");
  });
  // Provide realpathSync hooks so tests can simulate canonicalization behavior.
  const realpathSync = vi.fn((p) => p);
  const readFileSync = vi.fn(() => {
    throw new Error("node:fs.readFileSync should not be called during tests");
  });
  const statSync = vi.fn(() => {
    throw new Error("node:fs.statSync should not be called during tests");
  });
  return {
    readdirSync,
    realpathSync,
    realpathSyncNative: realpathSync,
    readFileSync,
    statSync,
  };
});

describe("payload-parsers", () => {
  it("parseDialogOptions preserves title and filters unsupported properties", async () => {
    const parsers: any = await import(
      "../../../apps/desktop/src/main/ipc/payload-parsers"
    );

    const input = {
      title: "Choose files",
      properties: ["openFile", "createDirectory", "UNSUPPORTED_PROPERTY"],
    };

    const out = parsers.parseDialogOptions(input);

    // Title must be preserved
    expect(out.title).toBe("Choose files");
    // Unsupported values should be removed from properties
    expect(out.properties).toEqual(
      expect.arrayContaining(["openFile", "createDirectory"]),
    );
    expect(out.properties).not.toEqual(
      expect.arrayContaining(["UNSUPPORTED_PROPERTY"]),
    );
  });

  it("parseSearchRequest returns null when either query or rootPath is missing, and returns expected object when both are present", async () => {
    const parsers: any = await import(
      "../../../apps/desktop/src/main/ipc/payload-parsers"
    );

    expect(parsers.parseSearchRequest({})).toBeNull();
    expect(parsers.parseSearchRequest({ query: "app" })).toBeNull();
    expect(parsers.parseSearchRequest({ rootPath: "/tmp" })).toBeNull();

    const req = parsers.parseSearchRequest({
      query: "app",
      rootPath: "/tmp/pidesk",
      includePatterns: ["**/*.ts"],
      excludePatterns: ["node_modules"],
    });

    expect(req).toMatchObject({
      query: "app",
      rootPath: "/tmp/pidesk",
      includePatterns: ["**/*.ts"],
      excludePatterns: ["node_modules"],
    });
  });

  it("parseTerminalCreateOptions returns null when ownerWindowId is missing, normalizes supported backends, and strips unsupported backends", async () => {
    const parsers: any = await import(
      "../../../apps/desktop/src/main/ipc/payload-parsers"
    );

    // missing ownerWindowId => null
    expect(
      parsers.parseTerminalCreateOptions({ id: "t1", cols: 80, rows: 24 }),
    ).toBeNull();

    // supported backend should produce a normalized options object
    const good = parsers.parseTerminalCreateOptions({
      id: "t-good",
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-t-good",
      backend: "lazygit",
    });

    expect(good).toMatchObject({
      id: "t-good",
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-t-good",
      backend: "lazygit",
    });

    // unsupported backend should be stripped rather than rejecting the payload
    const bad = parsers.parseTerminalCreateOptions({
      id: "t-bad",
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-t-bad",
      backend: "unsupported-backend",
    });

    expect(bad).toMatchObject({
      id: "t-bad",
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-t-bad",
    });
    expect(bad?.backend).toBeUndefined();
  });
});

// Mock the promise-based fs API used for mkdir/writeFile so tests can assert
// whether production code attempted to perform disk writes.
vi.mock("node:fs/promises", () => {
  const mkdir = vi.fn(() => {
    throw new Error("node:fs/promises.mkdir should not be called during tests");
  });
  const writeFile = vi.fn(() => {
    throw new Error(
      "node:fs/promises.writeFile should not be called during tests",
    );
  });
  return { mkdir, writeFile };
});

it("fs.readFile rejects out-of-workspace absolute paths before touching node:fs.readFileSync/statSync", async () => {
  const harness = createHandlerHarness();
  const shellSnapshot = createShellSnapshot();
  // ensure workspace root is /tmp/pidesk for the policy
  shellSnapshot.workspace!.rootPath = "/tmp/pidesk";
  const getShellSnapshot = vi.fn(() => shellSnapshot);

  registerIpcHandlers({
    handle: harness.handle,
    getShellSnapshot,
    agentHost: createAgentHost(createAgentSnapshot()),
    mainWindow: null,
  });

  const nodeFs: any = await import("node:fs");
  nodeFs.readFileSync.mockClear();
  nodeFs.statSync.mockClear();
  nodeFs.realpathSync.mockImplementation((value: string) => value);

  await expect(
    harness.handlers.get(IPC_CHANNELS.fs.readFile)?.(undefined, {
      path: "/etc/passwd",
    }),
  ).rejects.toThrow(/outside the workspace root/);

  expect(nodeFs.readFileSync).not.toHaveBeenCalled();
  expect(nodeFs.statSync).not.toHaveBeenCalled();
});

it("fs.writeFile rejects out-of-workspace absolute paths before touching node:fs/promises.mkdir or writeFile", async () => {
  const harness = createHandlerHarness();
  const shellSnapshot = createShellSnapshot();
  shellSnapshot.workspace!.rootPath = "/tmp/pidesk";
  const getShellSnapshot = vi.fn(() => shellSnapshot);

  registerIpcHandlers({
    handle: harness.handle,
    getShellSnapshot,
    agentHost: createAgentHost(createAgentSnapshot()),
    mainWindow: null,
  });

  const nodeFsPromises: any = await import("node:fs/promises");
  nodeFsPromises.mkdir.mockClear();
  nodeFsPromises.writeFile.mockClear();
  // ensure calls would succeed if they happened; tests assert they should not
  nodeFsPromises.mkdir.mockImplementation(() => Promise.resolve());
  nodeFsPromises.writeFile.mockImplementation(() => Promise.resolve());

  await expect(
    harness.handlers.get(IPC_CHANNELS.fs.writeFile)?.(undefined, {
      path: "/etc/hosts",
      content: "hello",
    }),
  ).rejects.toThrow(/outside the workspace root/);

  expect(nodeFsPromises.mkdir).not.toHaveBeenCalled();
  expect(nodeFsPromises.writeFile).not.toHaveBeenCalled();
});

it("fs.writeFile resolves relative paths against the workspace root before writing", async () => {
  const harness = createHandlerHarness();
  const shellSnapshot = createShellSnapshot();
  shellSnapshot.workspace!.rootPath = "/tmp/pidesk";
  const getShellSnapshot = vi.fn(() => shellSnapshot);

  registerIpcHandlers({
    handle: harness.handle,
    getShellSnapshot,
    agentHost: createAgentHost(createAgentSnapshot()),
    mainWindow: null,
  });

  const nodeFsPromises: any = await import("node:fs/promises");
  nodeFsPromises.mkdir.mockClear();
  nodeFsPromises.writeFile.mockClear();
  nodeFsPromises.mkdir.mockImplementation(() => Promise.resolve());
  nodeFsPromises.writeFile.mockImplementation(() => Promise.resolve());

  await harness.handlers.get(IPC_CHANNELS.fs.writeFile)?.(undefined, {
    path: "notes/today.md",
    content: "I wrote this note",
  });

  // Expect production code to have anchored the relative path to the workspace
  expect(nodeFsPromises.mkdir).toHaveBeenCalledWith("/tmp/pidesk/notes", {
    recursive: true,
  });
  expect(nodeFsPromises.writeFile).toHaveBeenCalledWith(
    "/tmp/pidesk/notes/today.md",
    "I wrote this note",
    "utf-8",
  );
});

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
    const tmMock: any = {
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

  it("terminal manager initialization: mainWindow null calls initialize once and does not call setMainWindow", async () => {
    const harness = createHandlerHarness();
    const tmMock: any = {
      setMainWindow: vi.fn(),
      initialize: vi.fn(),
    };

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
    });

    expect(tmMock.initialize).toHaveBeenCalledTimes(1);
    expect(tmMock.setMainWindow).not.toHaveBeenCalled();
  });

  it("terminal manager initialization: calls setMainWindow before initialize when mainWindow is provided", async () => {
    const harness = createHandlerHarness();
    const callOrder: string[] = [];
    const tmMock: any = {
      setMainWindow: vi.fn(() => callOrder.push("setMainWindow")),
      initialize: vi.fn(() => callOrder.push("initialize")),
    };
    const fakeWindow = { id: "main-win" } as any;

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: fakeWindow,
      terminalManager: tmMock,
    });

    expect(callOrder).toEqual(["setMainWindow", "initialize"]);
  });

  it("threads.routeToTerminal defaults startPiIfNotLinked to false when omitted", async () => {
    const harness = createHandlerHarness();
    const routeToTerminal = vi.fn(async () => ({
      success: true,
      threadId: "t-1",
    }));

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      routeToTerminal,
    });

    await harness.handlers.get(IPC_CHANNELS.threads.routeToTerminal)?.(
      undefined,
      {
        terminalId: "term-1",
        prompt: "echo hi",
      },
    );

    expect(routeToTerminal).toHaveBeenCalledWith({
      terminalId: "term-1",
      prompt: "echo hi",
      startPiIfNotLinked: false,
    });
  });

  it("terminal.create malformed payload should mention ownerWindowId in the error", async () => {
    const harness = createHandlerHarness();
    const tmMock: any = {
      setMainWindow: vi.fn(),
      initialize: vi.fn(),
      isAvailable: vi.fn(() => true),
      getError: vi.fn(() => null),
    };

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
    });

    // Missing ownerWindowId — the error message should mention it as a required field
    await expect(
      harness.handlers.get(IPC_CHANNELS.terminal.create)?.(undefined, {
        id: "term-1",
        cols: 80,
        rows: 24,
      }),
    ).rejects.toThrow(/ownerWindowId/);
  });

  it("fs.readDirectory malformed payload should resolve a typed error object instead of throwing", async () => {
    const harness = createHandlerHarness();

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(undefined, {}),
    ).resolves.toEqual({
      success: false,
      error: expect.stringContaining("path"),
    });
  });

  it("fs.readDirectory outside workspace root should not call node:fs and should resolve a typed error", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    // ensure workspace root is /tmp/pidesk for the policy
    shellSnapshot.workspace!.rootPath = "/tmp/pidesk";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs: any = await import("node:fs");
    nodeFs.readdirSync.mockClear();
    nodeFs.realpathSync.mockImplementation((value: string) => value);

    await expect(
      harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(undefined, {
        path: "/etc",
      }),
    ).resolves.toEqual({
      success: false,
      error: expect.stringContaining("outside the workspace root"),
    });

    expect(nodeFs.readdirSync).not.toHaveBeenCalled();
  });

  it("fs.readDirectory must reject paths that canonicalize outside the workspace root (symlink safety)", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    // ensure workspace root is /tmp/pidesk for the policy
    shellSnapshot.workspace!.rootPath = "/tmp/pidesk";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs: any = await import("node:fs");
    nodeFs.readdirSync.mockClear();

    // Simulate canonicalization outside the workspace and assert that the
    // handler rejects before attempting to read the directory.
    nodeFs.realpathSync?.mockImplementation?.((value: string) => {
      if (value === "/tmp/pidesk") {
        return "/tmp/pidesk";
      }

      if (value === "/tmp/pidesk/link-to-outside") {
        return "/outside/workspace";
      }

      return value;
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(undefined, {
        path: "/tmp/pidesk/link-to-outside",
      }),
    ).resolves.toEqual({
      success: false,
      error: expect.stringContaining("outside the workspace root"),
    });

    expect(nodeFs.readdirSync).not.toHaveBeenCalled();
  });

  it("fs.readDirectory returns entry paths based on the normalized resolved target", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    shellSnapshot.workspace!.rootPath = "/tmp/pidesk";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs: any = await import("node:fs");
    nodeFs.readdirSync.mockClear();
    nodeFs.realpathSync.mockImplementation((value: string) => value);

    const fakeEntries = [
      { name: "file1.txt", isDirectory: () => false, isFile: () => true },
      { name: "dir1", isDirectory: () => true, isFile: () => false },
    ];

    // Expect the handler to read the normalized (resolved) target path
    nodeFs.readdirSync.mockImplementation((targetPath, opts) => {
      expect(targetPath).toBe("/tmp/pidesk/project");
      return fakeEntries;
    });

    const result = await harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(
      undefined,
      { path: "/tmp/pidesk/project/../project" },
    );

    expect(result).toEqual({
      path: "/tmp/pidesk/project/../project",
      entries: [
        {
          name: "dir1",
          path: "/tmp/pidesk/project/dir1",
          type: "directory",
          extension: undefined,
        },
        {
          name: "file1.txt",
          path: "/tmp/pidesk/project/file1.txt",
          type: "file",
          extension: "txt",
        },
      ],
    });
  });

  it("fs.readDirectory resolves relative payload paths against the workspace root", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    // ensure workspace root is /tmp/pidesk for the policy
    shellSnapshot.workspace!.rootPath = "/tmp/pidesk";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs: any = await import("node:fs");
    nodeFs.readdirSync.mockClear();
    nodeFs.realpathSync.mockImplementation((value: string) => value);

    const fakeEntries = [
      { name: "file1.txt", isDirectory: () => false, isFile: () => true },
      { name: "dir1", isDirectory: () => true, isFile: () => false },
    ];

    // Production should resolve the relative payload "project" against
    // the workspace root (/tmp/pidesk) before calling node:fs.readdirSync.
    nodeFs.readdirSync.mockImplementation((targetPath, opts) => {
      expect(targetPath).toBe("/tmp/pidesk/project");
      return fakeEntries;
    });

    const result = await harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(
      undefined,
      { path: "project" },
    );

    expect(result).toEqual({
      path: "project",
      entries: [
        {
          name: "dir1",
          path: "/tmp/pidesk/project/dir1",
          type: "directory",
          extension: undefined,
        },
        {
          name: "file1.txt",
          path: "/tmp/pidesk/project/file1.txt",
          type: "file",
          extension: "txt",
        },
      ],
    });
  });
});
