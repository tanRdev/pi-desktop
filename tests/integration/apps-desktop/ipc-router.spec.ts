import type { Dirent, PathLike } from "node:fs";
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
    const parsers = await loadPayloadParsers();

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
    const parsers = await loadPayloadParsers();

    expect(parsers.parseSearchRequest({})).toBeNull();
    expect(parsers.parseSearchRequest({ query: "app" })).toBeNull();
    expect(parsers.parseSearchRequest({ rootPath: "/tmp" })).toBeNull();

    const req = parsers.parseSearchRequest({
      query: "app",
      rootPath: "/tmp/pi-desktop",
      includePatterns: ["**/*.ts"],
      excludePatterns: ["node_modules"],
    });

    expect(req).toMatchObject({
      query: "app",
      rootPath: "/tmp/pi-desktop",
      includePatterns: ["**/*.ts"],
      excludePatterns: ["node_modules"],
    });
  });

  it("parseTerminalCreateOptions returns null when ownerWindowId is missing, normalizes supported backends, and strips unsupported backends", async () => {
    const parsers = await loadPayloadParsers();

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
      backend: "pi",
    });

    expect(good).toMatchObject({
      id: "t-good",
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-t-good",
      backend: "pi",
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
  // ensure workspace root is /tmp/pi-desktop for the policy
  shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
  const getShellSnapshot = vi.fn(() => shellSnapshot);

  registerIpcHandlers({
    handle: harness.handle,
    getShellSnapshot,
    getWorkspaceRootPath: () => "/tmp/pi-desktop",
    agentHost: createAgentHost(createAgentSnapshot()),
    mainWindow: null,
  });

  const nodeFs = await loadMockedNodeFs();
  nodeFs.readFileSync.mockClear();
  nodeFs.statSync.mockClear();
  nodeFs.realpathSync.mockImplementation((value) => value.toString());

  await expect(
    harness.handlers.get(IPC_CHANNELS.fs.readFile)?.(undefined, {
      path: "/etc/passwd",
    }),
  ).rejects.toThrow(/path resolves outside every allowed root/);

  expect(nodeFs.readFileSync).not.toHaveBeenCalled();
  expect(nodeFs.statSync).not.toHaveBeenCalled();
});

it("fs.readFile rejects non-regular files before touching node:fs.readFileSync", async () => {
  const harness = createHandlerHarness();
  const shellSnapshot = createShellSnapshot();
  shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
  const getShellSnapshot = vi.fn(() => shellSnapshot);

  registerIpcHandlers({
    handle: harness.handle,
    getShellSnapshot,
    getWorkspaceRootPath: () => "/tmp/pi-desktop",
    agentHost: createAgentHost(createAgentSnapshot()),
    mainWindow: null,
  });

  const nodeFs = await loadMockedNodeFs();
  nodeFs.readFileSync.mockClear();
  nodeFs.statSync.mockClear();
  nodeFs.realpathSync.mockImplementation((value) => value.toString());
  nodeFs.statSync.mockImplementation((targetPath) => {
    expect(targetPath.toString()).toBe("/tmp/pi-desktop/fifo.txt");
    return {
      size: 0,
      isDirectory: () => false,
      isFile: () => false,
    } as ReturnType<typeof nodeFs.statSync>;
  });

  await expect(
    harness.handlers.get(IPC_CHANNELS.fs.readFile)?.(undefined, {
      path: "/tmp/pi-desktop/fifo.txt",
    }),
  ).rejects.toThrow(/not a regular file/);

  expect(nodeFs.readFileSync).not.toHaveBeenCalled();
  expect(nodeFs.statSync).toHaveBeenCalledWith("/tmp/pi-desktop/fifo.txt");
});

it("fs.writeFile rejects out-of-workspace absolute paths before touching node:fs/promises.mkdir or writeFile", async () => {
  const harness = createHandlerHarness();
  const shellSnapshot = createShellSnapshot();
  shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
  const getShellSnapshot = vi.fn(() => shellSnapshot);

  registerIpcHandlers({
    handle: harness.handle,
    getShellSnapshot,
    getWorkspaceRootPath: () => "/tmp/pi-desktop",
    agentHost: createAgentHost(createAgentSnapshot()),
    mainWindow: null,
  });

  const nodeFsPromises = await loadMockedNodeFsPromises();
  nodeFsPromises.mkdir.mockClear();
  nodeFsPromises.writeFile.mockClear();
  // ensure calls would succeed if they happened; tests assert they should not
  nodeFsPromises.mkdir.mockResolvedValue(undefined);
  nodeFsPromises.writeFile.mockResolvedValue(undefined);

  await expect(
    harness.handlers.get(IPC_CHANNELS.fs.writeFile)?.(undefined, {
      path: "/etc/hosts",
      content: "hello",
    }),
  ).rejects.toThrow(/path resolves outside every allowed root/);

  expect(nodeFsPromises.mkdir).not.toHaveBeenCalled();
  expect(nodeFsPromises.writeFile).not.toHaveBeenCalled();
});

it("fs.writeFile resolves relative paths against the workspace root before writing", async () => {
  const harness = createHandlerHarness();
  const shellSnapshot = createShellSnapshot();
  shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
  const getShellSnapshot = vi.fn(() => shellSnapshot);

  registerIpcHandlers({
    handle: harness.handle,
    getShellSnapshot,
    getWorkspaceRootPath: () => "/tmp/pi-desktop",
    agentHost: createAgentHost(createAgentSnapshot()),
    mainWindow: null,
  });

  const nodeFsPromises = await loadMockedNodeFsPromises();
  nodeFsPromises.mkdir.mockClear();
  nodeFsPromises.writeFile.mockClear();
  nodeFsPromises.mkdir.mockResolvedValue(undefined);
  nodeFsPromises.writeFile.mockResolvedValue(undefined);

  await harness.handlers.get(IPC_CHANNELS.fs.writeFile)?.(undefined, {
    path: "notes/today.md",
    content: "I wrote this note",
  });

  // Expect production code to have anchored the relative path to the workspace
  expect(nodeFsPromises.mkdir).toHaveBeenCalledWith("/tmp/pi-desktop/notes", {
    recursive: true,
  });
  expect(nodeFsPromises.writeFile).toHaveBeenCalledWith(
    "/tmp/pi-desktop/notes/today.md",
    "I wrote this note",
    "utf-8",
  );
});

import type { BrowserWindow } from "electron";
import { registerIpcHandlers } from "../../../apps/desktop/src/main/ipc-router";
import { TerminalManager } from "../../../apps/desktop/src/main/terminal-manager";
import {
  type AgentSnapshot,
  type AppPreferences,
  createEmptyWorkspaceSession,
  IPC_CHANNELS,
  type PiDiscoveryResult,
  type RepositoryPreferences,
  type SearchResponse,
  type ShellSnapshot,
  type TerminalSession,
  type WorkspaceSession,
} from "../../../packages/shared/src";

type ShellSnapshotWithWorkspace = ShellSnapshot & {
  workspace: NonNullable<ShellSnapshot["workspace"]>;
};
type MockedReadDirSync = {
  mockClear(): void;
  mockImplementation(
    implementation: (targetPath: PathLike, options?: unknown) => Dirent[],
  ): unknown;
};
type MockedRealpathSync = {
  mockImplementation(implementation: (path: PathLike) => string): unknown;
};

async function loadPayloadParsers() {
  return import("../../../apps/desktop/src/main/ipc/payload-parsers");
}

async function loadMockedNodeFs() {
  const nodeFs = await import("node:fs");
  return {
    readdirSync: nodeFs.readdirSync as unknown as MockedReadDirSync,
    realpathSync: nodeFs.realpathSync as unknown as MockedRealpathSync,
    readFileSync: vi.mocked(nodeFs.readFileSync),
    statSync: vi.mocked(nodeFs.statSync),
  };
}

async function loadMockedNodeFsPromises() {
  const nodeFsPromises = await import("node:fs/promises");
  return {
    mkdir: vi.mocked(nodeFsPromises.mkdir),
    writeFile: vi.mocked(nodeFsPromises.writeFile),
  };
}

function createDirent(
  name: string,
  kind: "file" | "directory" | "fifo",
): Dirent {
  return {
    name,
    path: "",
    parentPath: "",
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isDirectory: () => kind === "directory",
    isFIFO: () => kind === "fifo",
    isFile: () => kind === "file",
    isSocket: () => false,
    isSymbolicLink: () => false,
    isUnknown: () => false,
  } as unknown as Dirent;
}

function createTerminalSession(
  overrides: Partial<TerminalSession> = {},
): TerminalSession {
  return {
    id: "term-1",
    backend: "shell",
    cwd: "/tmp",
    status: "ready",
    ownerWindowId: "terminal-term-1",
    createdAt: Date.now(),
    ...overrides,
  };
}

function createTerminalManagerMock(
  overrides: {
    setMainWindow?: BrowserWindow extends infer _Window
      ? (window: BrowserWindow) => void
      : never;
    initialize?: () => void;
    isAvailable?: () => boolean;
    getError?: () => Error | null;
    create?: TerminalManager["create"];
    write?: TerminalManager["write"];
    resize?: TerminalManager["resize"];
    destroy?: TerminalManager["destroy"];
    destroyAll?: TerminalManager["destroyAll"];
    get?: TerminalManager["get"];
    getSessions?: TerminalManager["getSessions"];
    isOwnedBy?: TerminalManager["isOwnedBy"];
  } = {},
): TerminalManager {
  const manager = new TerminalManager();

  vi.spyOn(manager, "setMainWindow").mockImplementation(
    overrides.setMainWindow ?? (() => {}),
  );
  vi.spyOn(manager, "initialize").mockImplementation(
    overrides.initialize ?? (() => {}),
  );
  vi.spyOn(manager, "isAvailable").mockImplementation(
    overrides.isAvailable ?? (() => true),
  );
  vi.spyOn(manager, "getError").mockImplementation(
    overrides.getError ?? (() => null),
  );
  vi.spyOn(manager, "create").mockImplementation(
    overrides.create ?? (() => createTerminalSession()),
  );
  vi.spyOn(manager, "write").mockImplementation(overrides.write ?? (() => {}));
  vi.spyOn(manager, "resize").mockImplementation(
    overrides.resize ?? (() => {}),
  );
  vi.spyOn(manager, "destroy").mockImplementation(
    overrides.destroy ?? (() => {}),
  );
  vi.spyOn(manager, "destroyAll").mockImplementation(
    overrides.destroyAll ?? (() => {}),
  );
  vi.spyOn(manager, "get").mockImplementation(
    overrides.get ?? (() => undefined),
  );
  vi.spyOn(manager, "getSessions").mockImplementation(
    overrides.getSessions ?? (() => []),
  );
  vi.spyOn(manager, "isOwnedBy").mockImplementation(
    overrides.isOwnedBy ?? (() => true),
  );

  return manager;
}

function createShellSnapshot(): ShellSnapshotWithWorkspace {
  return {
    appName: "Pi Desktop",
    appVersion: "0.1.0",
    chromeVersion: "41.0.1",
    platform: "darwin",
    mode: "test",
    runtime: {
      agentMode: "mock",
      electronVersion: "41.0.1",
      agentDirectory: "/tmp/pi-desktop/.pi-desktop-agent",
    },
    workspace: {
      rootPath: "/tmp/pi-desktop",
      agentDirectory: "/tmp/pi-desktop/.pi-desktop-agent",
      projects: [
        {
          id: "/tmp/pi-desktop",
          name: "pi-desktop",
          path: "/tmp/pi-desktop",
          isActive: true,
        },
      ],
    },
    catalog: {
      selection: {
        repositoryId: "/tmp/pi-desktop",
        worktreeId: "/tmp/pi-desktop",
        threadId: "default-thread",
      },
      repositories: [
        {
          id: "/tmp/pi-desktop",
          name: "pi-desktop",
          rootPath: "/tmp/pi-desktop",
          defaultBranch: "main",
          worktrees: [
            {
              id: "/tmp/pi-desktop",
              label: "main",
              path: "/tmp/pi-desktop",
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
                  title: "North Star",
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
    cancelPrompt: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    addRepository: vi.fn(async () => undefined),
    selectRepository: vi.fn(async () => undefined),
    reorderRepositories: vi.fn(async () => undefined),
    createWorktree: vi.fn(async () => undefined),
    selectWorktree: vi.fn(async () => undefined),
    createThread: vi.fn(async () => undefined),
    selectThread: vi.fn(async () => undefined),
  };
}

function createStateHost() {
  const repositoryPreferences: RepositoryPreferences = {
    repositoryId: "/tmp/pi-desktop",
    customName: "Pi Desktop",
    icon: "pi",
    accentColor: "#224466",
  };
  const workspaceSession: WorkspaceSession =
    createEmptyWorkspaceSession("/tmp/pi-desktop");
  const appPreferences: AppPreferences = {
    leftSidebarWidth: 220,
  };

  return {
    getRepositoryPreferences: vi.fn(async () => repositoryPreferences),
    updateRepositoryPreferences: vi.fn(async () => repositoryPreferences),
    getWorkspaceSession: vi.fn(async () => workspaceSession),
    saveWorkspaceSession: vi.fn(async () => workspaceSession),
    getAppPreferences: vi.fn(async () => appPreferences),
    updateAppPreferences: vi.fn(async () => appPreferences),
    importLegacyPreferences: vi.fn(async () => ({
      repositoryPreferences: [repositoryPreferences],
      appPreferences,
    })),
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
      { path: "/tmp/pi-desktop" },
    );
    await harness.handlers.get(IPC_CHANNELS.repositories.select)?.(
      { sender: "electron-ipc-event" },
      { repositoryId: "/tmp/pi-desktop" },
    );
    await harness.handlers.get(IPC_CHANNELS.repositories.reorder)?.(
      { sender: "electron-ipc-event" },
      {
        repositoryIds: ["/tmp/second", "/tmp/pi-desktop"],
      },
    );
    await harness.handlers.get(IPC_CHANNELS.worktrees.create)?.(
      { sender: "electron-ipc-event" },
      {
        repositoryId: "/tmp/pi-desktop",
        branchName: "feature/runtime",
      },
    );
    await harness.handlers.get(IPC_CHANNELS.worktrees.select)?.(
      { sender: "electron-ipc-event" },
      { worktreeId: "/tmp/pi-desktop-feature" },
    );
    await harness.handlers.get(IPC_CHANNELS.threads.create)?.(
      { sender: "electron-ipc-event" },
      {
        worktreeId: "/tmp/pi-desktop-feature",
      },
    );
    await harness.handlers.get(IPC_CHANNELS.threads.select)?.(
      { sender: "electron-ipc-event" },
      { threadId: "thread-123" },
    );

    expect(getShellSnapshot).toHaveBeenCalledTimes(1);
    expect(agentHost.getSnapshot).toHaveBeenCalledTimes(1);
    expect(agentHost.prompt).toHaveBeenCalledWith("Inspect the workspace");
    expect(agentHost.addRepository).toHaveBeenCalledWith("/tmp/pi-desktop");
    expect(agentHost.selectRepository).toHaveBeenCalledWith("/tmp/pi-desktop");
    expect(agentHost.reorderRepositories).toHaveBeenCalledWith([
      "/tmp/second",
      "/tmp/pi-desktop",
    ]);
    expect(agentHost.createWorktree).toHaveBeenCalledWith(
      "/tmp/pi-desktop",
      "feature/runtime",
    );
    expect(agentHost.selectWorktree).toHaveBeenCalledWith(
      "/tmp/pi-desktop-feature",
    );
    expect(agentHost.createThread).toHaveBeenCalledWith(
      "/tmp/pi-desktop-feature",
    );
    expect(agentHost.selectThread).toHaveBeenCalledWith("thread-123");
  });

  it("binds terminal.create and getSessions handlers returning full TerminalSession descriptors", async () => {
    const harness = createHandlerHarness();
    const fakeSession = createTerminalSession();
    const tmMock = createTerminalManagerMock({
      create: vi.fn(() => fakeSession),
      getSessions: vi.fn(() => [fakeSession]),
    });

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
      getAllowedTerminalCwds: () => ["/tmp/allowed-repo"],
    });

    const createPayload = {
      id: "term-1",
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-term-1",
      backend: "pi",
      cwd: "/tmp/allowed-repo",
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
    expect(tmMock.create).toHaveBeenCalledWith(
      "term-1",
      createPayload,
      "__no_sender__",
    );
  });

  it("terminal.create rejects cwd outside allowed repository roots", async () => {
    const harness = createHandlerHarness();
    const tmMock = createTerminalManagerMock({
      create: vi.fn(() => createTerminalSession()),
    });

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
      getAllowedTerminalCwds: () => ["/tmp/allowed-repo"],
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.terminal.create)?.(undefined, {
        id: "term-evil",
        cols: 80,
        rows: 24,
        ownerWindowId: "terminal-term-evil",
        backend: "shell",
        cwd: "/etc",
      }),
    ).rejects.toThrow(/not within any allowed/i);
    expect(tmMock.create).not.toHaveBeenCalled();
  });

  it("terminal.create rejects when no cwd is provided", async () => {
    const harness = createHandlerHarness();
    const tmMock = createTerminalManagerMock({
      create: vi.fn(() => createTerminalSession()),
    });

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
      getAllowedTerminalCwds: () => ["/tmp/allowed-repo"],
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.terminal.create)?.(undefined, {
        id: "term-nocwd",
        cols: 80,
        rows: 24,
        ownerWindowId: "terminal-term-nocwd",
        backend: "shell",
      }),
    ).rejects.toThrow(/cwd/);
    expect(tmMock.create).not.toHaveBeenCalled();
  });

  it("terminal.create accepts subdirectories of an allowed root", async () => {
    const harness = createHandlerHarness();
    const fakeSession = createTerminalSession();
    const tmMock = createTerminalManagerMock({
      create: vi.fn(() => fakeSession),
    });

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
      getAllowedTerminalCwds: () => ["/tmp/allowed-repo"],
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.terminal.create)?.(undefined, {
        id: "term-sub",
        cols: 80,
        rows: 24,
        ownerWindowId: "terminal-term-sub",
        backend: "shell",
        cwd: "/tmp/allowed-repo/src/feature",
      }),
    ).resolves.toEqual(fakeSession);
    expect(tmMock.create).toHaveBeenCalled();
  });

  it("binds state persistence handlers", async () => {
    const harness = createHandlerHarness();
    const stateHost = createStateHost();
    const session = createEmptyWorkspaceSession("/tmp/pi-desktop");

    session.layout.windows.push({
      id: "chat-1",
      kind: "chat",
      title: "North Star",
      x: 20,
      y: 20,
      width: 600,
      height: 400,
      zIndex: 1,
      isFocused: true,
      state: "normal",
      threadId: "default-thread",
      messages: ["drop me"],
    } as never);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      stateHost,
      mainWindow: null,
    });

    await harness.handlers.get(IPC_CHANNELS.state.getRepositoryPreferences)?.(
      undefined,
      { repositoryId: "/tmp/pi-desktop" },
    );
    await harness.handlers.get(
      IPC_CHANNELS.state.updateRepositoryPreferences,
    )?.(undefined, {
      repositoryId: "/tmp/pi-desktop",
      updates: {
        customName: "Pi Desktop",
        icon: "pi",
        accentColor: "#224466",
      },
    });
    await harness.handlers.get(IPC_CHANNELS.state.getWorkspaceSession)?.(
      undefined,
      { worktreeId: "/tmp/pi-desktop" },
    );
    await harness.handlers.get(IPC_CHANNELS.state.saveWorkspaceSession)?.(
      undefined,
      {
        session: {
          ...session,
          transcriptBodies: {
            "default-thread": "drop me",
          },
          runtimeState: {
            status: "streaming",
          },
        },
      },
    );
    await harness.handlers.get(IPC_CHANNELS.state.getAppPreferences)?.();
    await harness.handlers.get(IPC_CHANNELS.state.updateAppPreferences)?.(
      undefined,
      {
        updates: {
          leftSidebarWidth: 220,
        },
      },
    );
    await harness.handlers.get(IPC_CHANNELS.state.importLegacyPreferences)?.(
      undefined,
      {
        importData: {
          leftSidebarWidth: 220,
          repositories: [
            {
              repositoryId: "/tmp/pi-desktop",
              customName: "Pi Desktop",
            },
          ],
        },
      },
    );

    expect(stateHost.getRepositoryPreferences).toHaveBeenCalledWith(
      "/tmp/pi-desktop",
    );
    expect(stateHost.updateRepositoryPreferences).toHaveBeenCalledWith(
      "/tmp/pi-desktop",
      {
        customName: "Pi Desktop",
        icon: "pi",
        accentColor: "#224466",
      },
    );
    expect(stateHost.getWorkspaceSession).toHaveBeenCalledWith(
      "/tmp/pi-desktop",
    );
    expect(stateHost.saveWorkspaceSession).toHaveBeenCalledWith({
      ...session,
      layout: {
        ...session.layout,
        windows: [
          {
            id: "chat-1",
            kind: "chat",
            title: "North Star",
            x: 20,
            y: 20,
            width: 600,
            height: 400,
            zIndex: 1,
            isFocused: true,
            state: "normal",
            threadId: "default-thread",
          },
        ],
      },
    });
    expect(stateHost.getAppPreferences).toHaveBeenCalledTimes(1);
    expect(stateHost.updateAppPreferences).toHaveBeenCalledWith({
      leftSidebarWidth: 220,
    });
    expect(stateHost.importLegacyPreferences).toHaveBeenCalledWith({
      leftSidebarWidth: 220,
      repositories: [
        {
          repositoryId: "/tmp/pi-desktop",
          customName: "Pi Desktop",
        },
      ],
    });
  });

  it("registers a dialog handler for safe external links", async () => {
    const harness = createHandlerHarness();

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    expect(harness.handlers.has(IPC_CHANNELS.dialog.openExternal)).toBe(true);
  });

  it("delegates discovery, slash suggestions, search, and model switch", async () => {
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
          path: "/tmp/pi-desktop/apps/desktop/src/renderer/src/app.tsx",
          name: "app.tsx",
          score: 100,
          type: "file",
        },
      ],
      total: 1,
      duration: 4,
    };
    const switchModel = vi.fn(async () => undefined);
    const getDiscovery = vi.fn(async () => discovery);
    const getSlashSuggestions = vi.fn(async () => slashSuggestions);
    const searchFiles = vi.fn(async () => searchResponse);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      switchModel,
      getDiscovery,
      getSlashSuggestions,
      searchFiles,
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
        rootPath: "/tmp/pi-desktop",
      }),
    ).resolves.toEqual(searchResponse);
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
      rootPath: "/tmp/pi-desktop",
    });
    expect(switchModel).toHaveBeenCalledWith({
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });
  });

  it("delegates oauth provider listing and login handlers", async () => {
    const harness = createHandlerHarness();
    const authProviders = [
      {
        id: "anthropic",
        name: "Anthropic (Claude Pro/Max)",
        usesCallbackServer: false,
      },
    ];
    const getOAuthProviders = vi.fn(async () => authProviders);
    const loginWithOAuth = vi.fn(async () => undefined);
    const logoutOAuth = vi.fn(async () => undefined);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      getOAuthProviders,
      loginWithOAuth,
      logoutOAuth,
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.agent.getOAuthProviders)?.(),
    ).resolves.toEqual(authProviders);

    await harness.handlers.get(IPC_CHANNELS.agent.loginWithOAuth)?.(undefined, {
      providerId: "anthropic",
    });
    await harness.handlers.get(IPC_CHANNELS.agent.logoutOAuth)?.(undefined, {
      providerId: "anthropic",
    });

    expect(getOAuthProviders).toHaveBeenCalledTimes(1);
    expect(loginWithOAuth).toHaveBeenCalledWith("anthropic");
    expect(logoutOAuth).toHaveBeenCalledWith("anthropic");
  });

  it("binds package handlers when a packages service is provided", async () => {
    const harness = createHandlerHarness();
    const packagesService = {
      getManagerStatus: vi.fn(async () => ({
        cli: "available" as const,
        network: "available" as const,
        authenticated: true,
        message: null,
      })),
      searchCatalog: vi.fn(async () => ({
        query: "skill",
        sort: "downloads" as const,
        total: 1,
        packages: [],
      })),
      getPackageDetail: vi.fn(async (packageName: string) => ({
        name: packageName,
        version: "1.0.0",
        description: "detail",
        downloads: 0,
        publishedAt: null,
        kinds: [],
        author: null,
        maintainers: [],
        repositoryUrl: null,
        npmUrl: `https://www.npmjs.com/package/${packageName}`,
        readmeUrl: null,
        hasDemo: false,
        demoVideoUrl: null,
        demoImageUrl: null,
        keywords: [],
        readmeMarkdown: null,
        installCommand: `pi install npm:${packageName}`,
      })),
      listInstalled: vi.fn(async () => []),
      install: vi.fn(async () => ({
        id: "install-1",
        packageName: "@acme/pi-tools",
        scope: "local" as const,
        kind: "install" as const,
        status: "queued" as const,
        message: null,
        output: [],
      })),
      remove: vi.fn(async () => ({
        id: "remove-1",
        packageName: "@acme/pi-tools",
        scope: "global" as const,
        kind: "remove" as const,
        status: "queued" as const,
        message: null,
        output: [],
      })),
      update: vi.fn(async () => ({
        id: "update-1",
        packageName: "",
        scope: "global" as const,
        kind: "update" as const,
        status: "queued" as const,
        message: null,
        output: [],
      })),
      subscribe: vi.fn(() => () => undefined),
    };

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      packagesService,
    });

    await harness.handlers.get(IPC_CHANNELS.packages.getManagerStatus)?.();
    await harness.handlers.get(IPC_CHANNELS.packages.searchCatalog)?.(
      undefined,
      {
        query: "skill",
        sort: "downloads",
        kinds: ["skill", "invalid"],
        hasDemoOnly: true,
      },
    );
    await harness.handlers.get(IPC_CHANNELS.packages.getPackageDetail)?.(
      undefined,
      { packageName: "@acme/pi-tools" },
    );
    await harness.handlers.get(IPC_CHANNELS.packages.listInstalled)?.(
      undefined,
      { scope: "local" },
    );
    await harness.handlers.get(IPC_CHANNELS.packages.install)?.(undefined, {
      packageName: "@acme/pi-tools",
      scope: "local",
    });
    await harness.handlers.get(IPC_CHANNELS.packages.remove)?.(undefined, {
      packageName: "@acme/pi-tools",
      scope: "global",
    });
    await harness.handlers.get(IPC_CHANNELS.packages.update)?.(undefined, {
      scope: "global",
    });

    expect(packagesService.getManagerStatus).toHaveBeenCalledTimes(1);
    expect(packagesService.searchCatalog).toHaveBeenCalledWith({
      query: "skill",
      sort: "downloads",
      kinds: ["skill"],
      hasDemoOnly: true,
    });
    expect(packagesService.getPackageDetail).toHaveBeenCalledWith(
      "@acme/pi-tools",
    );
    expect(packagesService.listInstalled).toHaveBeenCalledWith("local");
    expect(packagesService.install).toHaveBeenCalledWith({
      packageName: "@acme/pi-tools",
      scope: "local",
    });
    expect(packagesService.remove).toHaveBeenCalledWith({
      packageName: "@acme/pi-tools",
      scope: "global",
    });
    expect(packagesService.update).toHaveBeenCalledWith({
      packageName: undefined,
      scope: "global",
    });
  });

  it("terminal manager initialization: mainWindow null calls initialize once and does not call setMainWindow", async () => {
    const harness = createHandlerHarness();
    const tmMock = createTerminalManagerMock();

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
    const tmMock = createTerminalManagerMock({
      setMainWindow: vi.fn(() => callOrder.push("setMainWindow")),
      initialize: vi.fn(() => callOrder.push("initialize")),
    });
    const fakeWindow = { id: "main-win" } as unknown as BrowserWindow;

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: fakeWindow,
      terminalManager: tmMock,
    });

    expect(callOrder).toEqual(["setMainWindow", "initialize"]);
  });

  it("terminal.create malformed payload should mention ownerWindowId in the error", async () => {
    const harness = createHandlerHarness();
    const tmMock = createTerminalManagerMock();

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
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("path"),
        code: expect.stringMatching(/^payload\//),
      }),
    );
  });

  it("fs.readDirectory outside workspace root should not call node:fs and should resolve a typed error", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    // ensure workspace root is /tmp/pi-desktop for the policy
    shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      getWorkspaceRootPath: () => "/tmp/pi-desktop",
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs = await loadMockedNodeFs();
    nodeFs.readdirSync.mockClear();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());

    await expect(
      harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(undefined, {
        path: "/etc",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(
          /path resolves outside every allowed root/,
        ),
        code: "path/outside-root",
      }),
    );

    expect(nodeFs.readdirSync).not.toHaveBeenCalled();
  });

  it("fs.readDirectory must reject paths that canonicalize outside the workspace root (symlink safety)", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    // ensure workspace root is /tmp/pi-desktop for the policy
    shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      getWorkspaceRootPath: () => "/tmp/pi-desktop",
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs = await loadMockedNodeFs();
    nodeFs.readdirSync.mockClear();

    // Simulate canonicalization outside the workspace and assert that the
    // handler rejects before attempting to read the directory.
    nodeFs.realpathSync.mockImplementation((value) => {
      if (value.toString() === "/tmp/pi-desktop") {
        return "/tmp/pi-desktop";
      }

      if (value.toString() === "/tmp/pi-desktop/link-to-outside") {
        return "/outside/workspace";
      }

      return value.toString();
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(undefined, {
        path: "/tmp/pi-desktop/link-to-outside",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(
          /path resolves \(via symlink\) outside every allowed root/,
        ),
        code: "path/symlink-escape",
      }),
    );

    expect(nodeFs.readdirSync).not.toHaveBeenCalled();
  });

  it("fs.readDirectory returns entry paths based on the normalized resolved target", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      getWorkspaceRootPath: () => "/tmp/pi-desktop",
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs = await loadMockedNodeFs();
    nodeFs.readdirSync.mockClear();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());

    const fakeEntries = [
      createDirent("file1.txt", "file"),
      createDirent("dir1", "directory"),
    ];

    // Expect the handler to read the normalized (resolved) target path
    nodeFs.readdirSync.mockImplementation((targetPath) => {
      expect(targetPath).toBe("/tmp/pi-desktop/project");
      return fakeEntries;
    });

    const result = await harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(
      undefined,
      { path: "/tmp/pi-desktop/project/../project" },
    );

    expect(result).toEqual({
      path: "/tmp/pi-desktop/project/../project",
      entries: [
        {
          name: "dir1",
          path: "/tmp/pi-desktop/project/dir1",
          type: "directory",
          extension: undefined,
        },
        {
          name: "file1.txt",
          path: "/tmp/pi-desktop/project/file1.txt",
          type: "file",
          extension: "txt",
        },
      ],
    });
  });

  it("fs.readDirectory resolves relative payload paths against the workspace root", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    // ensure workspace root is /tmp/pi-desktop for the policy
    shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      getWorkspaceRootPath: () => "/tmp/pi-desktop",
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs = await loadMockedNodeFs();
    nodeFs.readdirSync.mockClear();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());

    const fakeEntries = [
      createDirent("file1.txt", "file"),
      createDirent("dir1", "directory"),
    ];

    // Production should resolve the relative payload "project" against
    // the workspace root (/tmp/pi-desktop) before calling node:fs.readdirSync.
    nodeFs.readdirSync.mockImplementation((targetPath) => {
      expect(targetPath).toBe("/tmp/pi-desktop/project");
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
          path: "/tmp/pi-desktop/project/dir1",
          type: "directory",
          extension: undefined,
        },
        {
          name: "file1.txt",
          path: "/tmp/pi-desktop/project/file1.txt",
          type: "file",
          extension: "txt",
        },
      ],
    });
  });

  it("fs.readDirectory excludes non-regular entries such as FIFOs", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";
    const getShellSnapshot = vi.fn(() => shellSnapshot);

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot,
      getWorkspaceRootPath: () => "/tmp/pi-desktop",
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFs = await loadMockedNodeFs();
    nodeFs.readdirSync.mockClear();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());
    nodeFs.statSync.mockImplementation((targetPath) => {
      expect(targetPath.toString()).toBe("/tmp/pi-desktop/project/fifo.txt");
      return {
        isDirectory: () => false,
        isFile: () => false,
      } as ReturnType<typeof nodeFs.statSync>;
    });

    nodeFs.readdirSync.mockImplementation(() => [
      createDirent("fifo.txt", "fifo"),
      createDirent("notes.txt", "file"),
      createDirent("src", "directory"),
    ]);

    const result = await harness.handlers.get(IPC_CHANNELS.fs.readDirectory)?.(
      undefined,
      { path: "/tmp/pi-desktop/project" },
    );

    expect(result).toEqual({
      path: "/tmp/pi-desktop/project",
      entries: [
        {
          name: "src",
          path: "/tmp/pi-desktop/project/src",
          type: "directory",
          extension: undefined,
        },
        {
          name: "notes.txt",
          path: "/tmp/pi-desktop/project/notes.txt",
          type: "file",
          extension: "txt",
        },
      ],
    });
  });
});

describe("git handlers repositoryPath allowlist", () => {
  function createGitServiceMock() {
    return {
      getRepositoryStatus: vi.fn(() => ({
        worktreePath: "/allowed/repo",
        branch: "main",
        hasChanges: false,
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
        upstreamBranch: null,
      })),
      isRepository: vi.fn(() => true),
      init: vi.fn(() => undefined),
      stageFile: vi.fn(() => ({}) as never),
      stageFiles: vi.fn(() => ({}) as never),
      unstageFile: vi.fn(() => ({}) as never),
      unstageFiles: vi.fn(() => ({}) as never),
      discardFile: vi.fn(() => ({}) as never),
      commit: vi.fn(() => ({}) as never),
      pull: vi.fn(() => ({}) as never),
      push: vi.fn(() => ({}) as never),
      fetch: vi.fn(() => ({}) as never),
      inspect: vi.fn(),
      inspectAsync: vi.fn(),
    };
  }

  it("rejects git handlers when repositoryPath is not in the allowed roots and never calls gitService", async () => {
    const harness = createHandlerHarness();
    const gitService = createGitServiceMock();
    const nodeFs = await loadMockedNodeFs();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock of GitWorktreeService
      gitService: gitService as any,
      getAllowedRepositoryRoots: () => ["/allowed/repo"],
    });

    for (const channel of [
      IPC_CHANNELS.git.getRepositoryStatus,
      IPC_CHANNELS.git.stageFile,
      IPC_CHANNELS.git.stageFiles,
      IPC_CHANNELS.git.unstageFile,
      IPC_CHANNELS.git.unstageFiles,
      IPC_CHANNELS.git.discardFile,
      IPC_CHANNELS.git.commit,
      IPC_CHANNELS.git.pull,
      IPC_CHANNELS.git.push,
      IPC_CHANNELS.git.fetch,
    ]) {
      await expect(
        harness.handlers.get(channel)?.(undefined, {
          repositoryPath: "/etc",
          filePath: "passwd",
          filePaths: ["passwd"],
          message: "evil",
        }),
      ).rejects.toThrow(/path resolves outside every allowed root/i);
    }

    expect(gitService.getRepositoryStatus).not.toHaveBeenCalled();
    expect(gitService.isRepository).not.toHaveBeenCalled();
    expect(gitService.init).not.toHaveBeenCalled();
    expect(gitService.stageFile).not.toHaveBeenCalled();
    expect(gitService.stageFiles).not.toHaveBeenCalled();
    expect(gitService.unstageFile).not.toHaveBeenCalled();
    expect(gitService.unstageFiles).not.toHaveBeenCalled();
    expect(gitService.discardFile).not.toHaveBeenCalled();
    expect(gitService.commit).not.toHaveBeenCalled();
    expect(gitService.pull).not.toHaveBeenCalled();
    expect(gitService.push).not.toHaveBeenCalled();
    expect(gitService.fetch).not.toHaveBeenCalled();
  });

  it("allows pre-catalog git checks on arbitrary paths", async () => {
    const harness = createHandlerHarness();
    const gitService = createGitServiceMock();

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock of GitWorktreeService
      gitService: gitService as any,
      getAllowedRepositoryRoots: () => ["/allowed/repo"],
    });

    await harness.handlers.get(IPC_CHANNELS.git.isRepository)?.(undefined, {
      repositoryPath: "/etc",
    });
    await harness.handlers.get(IPC_CHANNELS.git.init)?.(undefined, {
      repositoryPath: "/tmp/new-repo",
    });

    expect(gitService.isRepository).toHaveBeenCalledWith("/etc");
    expect(gitService.init).toHaveBeenCalledWith("/tmp/new-repo");
  });

  it("routes git.fetch to gitService.fetch when repositoryPath is an allowed root", async () => {
    const harness = createHandlerHarness();
    const gitService = createGitServiceMock();
    const nodeFs = await loadMockedNodeFs();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock of GitWorktreeService
      gitService: gitService as any,
      getAllowedRepositoryRoots: () => ["/allowed/repo"],
    });

    await harness.handlers.get(IPC_CHANNELS.git.fetch)?.(undefined, {
      repositoryPath: "/allowed/repo",
    });

    expect(gitService.fetch).toHaveBeenCalledWith("/allowed/repo");
  });

  it("accepts git handlers when repositoryPath equals an allowed root", async () => {
    const harness = createHandlerHarness();
    const gitService = createGitServiceMock();
    const nodeFs = await loadMockedNodeFs();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock of GitWorktreeService
      gitService: gitService as any,
      getAllowedRepositoryRoots: () => ["/allowed/repo"],
    });

    await harness.handlers.get(IPC_CHANNELS.git.getRepositoryStatus)?.(
      undefined,
      {
        repositoryPath: "/allowed/repo",
      },
    );

    expect(gitService.getRepositoryStatus).toHaveBeenCalledWith(
      "/allowed/repo",
    );
  });

  it("accepts git handlers when repositoryPath is nested inside an allowed root (worktree under repo)", async () => {
    const harness = createHandlerHarness();
    const gitService = createGitServiceMock();
    const nodeFs = await loadMockedNodeFs();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock of GitWorktreeService
      gitService: gitService as any,
      getAllowedRepositoryRoots: () => ["/allowed/repo"],
    });

    await harness.handlers.get(IPC_CHANNELS.git.getRepositoryStatus)?.(
      undefined,
      {
        repositoryPath: "/allowed/repo/worktrees/feature",
      },
    );

    expect(gitService.getRepositoryStatus).toHaveBeenCalledWith(
      "/allowed/repo/worktrees/feature",
    );
  });

  it("rejects path-traversal attempts that normalize outside the allowed root", async () => {
    const harness = createHandlerHarness();
    const gitService = createGitServiceMock();
    const nodeFs = await loadMockedNodeFs();
    nodeFs.realpathSync.mockImplementation((value) => value.toString());

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock of GitWorktreeService
      gitService: gitService as any,
      getAllowedRepositoryRoots: () => ["/allowed/repo"],
    });

    await expect(
      harness.handlers.get(IPC_CHANNELS.git.discardFile)?.(undefined, {
        repositoryPath: "/allowed/repo/../../etc",
        filePath: "passwd",
      }),
    ).rejects.toThrow(/path resolves outside every allowed root/i);

    expect(gitService.discardFile).not.toHaveBeenCalled();
  });
});

describe("fs.writeFile size cap", () => {
  it("rejects payloads larger than 10 MiB before calling writeFile", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(() => shellSnapshot),
      getWorkspaceRootPath: () => "/tmp/pi-desktop",
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFsPromises = await loadMockedNodeFsPromises();
    nodeFsPromises.mkdir.mockClear();
    nodeFsPromises.writeFile.mockClear();
    nodeFsPromises.mkdir.mockResolvedValue(undefined);
    nodeFsPromises.writeFile.mockResolvedValue(undefined);

    const oversized = "x".repeat(10 * 1024 * 1024 + 1);

    await expect(
      harness.handlers.get(IPC_CHANNELS.fs.writeFile)?.(undefined, {
        path: "notes/huge.md",
        content: oversized,
      }),
    ).rejects.toThrow(/writeFile payload exceeds maximum size/i);

    expect(nodeFsPromises.mkdir).not.toHaveBeenCalled();
    expect(nodeFsPromises.writeFile).not.toHaveBeenCalled();
  });

  it("accepts payloads exactly at the 10 MiB boundary", async () => {
    const harness = createHandlerHarness();
    const shellSnapshot = createShellSnapshot();
    shellSnapshot.workspace.rootPath = "/tmp/pi-desktop";

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(() => shellSnapshot),
      getWorkspaceRootPath: () => "/tmp/pi-desktop",
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
    });

    const nodeFsPromises = await loadMockedNodeFsPromises();
    nodeFsPromises.mkdir.mockClear();
    nodeFsPromises.writeFile.mockClear();
    nodeFsPromises.mkdir.mockResolvedValue(undefined);
    nodeFsPromises.writeFile.mockResolvedValue(undefined);

    const atLimit = "x".repeat(10 * 1024 * 1024);

    await harness.handlers.get(IPC_CHANNELS.fs.writeFile)?.(undefined, {
      path: "notes/at-limit.md",
      content: atLimit,
    });

    expect(nodeFsPromises.writeFile).toHaveBeenCalledTimes(1);
  });
});

describe("terminal.write size cap", () => {
  it("rejects data larger than 64 KiB and never calls terminalManager.write", async () => {
    const harness = createHandlerHarness();
    const tmMock = createTerminalManagerMock();

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
    });

    const oversized = "a".repeat(64 * 1024 + 1);

    await expect(
      harness.handlers.get(IPC_CHANNELS.terminal.write)?.(undefined, {
        id: "sess-1",
        data: oversized,
      }),
    ).rejects.toThrow(/terminal\.write data exceeds maximum size/i);

    expect(tmMock.write).not.toHaveBeenCalled();
  });

  it("accepts data exactly at the 64 KiB boundary", async () => {
    const harness = createHandlerHarness();
    const tmMock = createTerminalManagerMock();

    registerIpcHandlers({
      handle: harness.handle,
      getShellSnapshot: vi.fn(createShellSnapshot),
      agentHost: createAgentHost(createAgentSnapshot()),
      mainWindow: null,
      terminalManager: tmMock,
    });

    const atLimit = "a".repeat(64 * 1024);

    await harness.handlers.get(IPC_CHANNELS.terminal.write)?.(undefined, {
      id: "sess-1",
      data: atLimit,
    });

    expect(tmMock.write).toHaveBeenCalledWith("sess-1", atLimit);
  });
});
