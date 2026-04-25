import type { WorkspaceSession } from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";

import { createShellStateIpcDependencies } from "./shell-state-ipc";

function createInspection(rootPath: string) {
  return {
    status: "repository" as const,
    rootPath,
    currentWorktreePath: `${rootPath}/worktrees/feature`,
    defaultBranch: "main",
    message: null,
    worktrees: [
      {
        id: rootPath,
        path: rootPath,
        isMain: true,
        isCurrent: false,
        isDetached: false,
        isPrunable: false,
        prunableReason: null,
        branch: "main",
        commit: "abc1234",
        git: {
          status: "ready" as const,
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
      },
      {
        id: `${rootPath}/worktrees/feature`,
        path: `${rootPath}/worktrees/feature`,
        isMain: false,
        isCurrent: true,
        isDetached: false,
        isPrunable: false,
        prunableReason: null,
        branch: "feature",
        commit: "def5678",
        git: {
          status: "ready" as const,
          branch: "feature",
          commit: "def5678",
          hasChanges: true,
          ahead: 1,
          behind: 0,
          stagedCount: 1,
          modifiedCount: 2,
          untrackedCount: 0,
          message: null,
        },
      },
    ],
  };
}

function createRootOnlyInspection(rootPath: string) {
  return {
    status: "repository" as const,
    rootPath,
    currentWorktreePath: rootPath,
    defaultBranch: "main",
    message: null,
    worktrees: [
      {
        id: rootPath,
        path: rootPath,
        isMain: true,
        isCurrent: true,
        isDetached: false,
        isPrunable: false,
        prunableReason: null,
        branch: "main",
        commit: "abc1234",
        git: {
          status: "ready" as const,
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
      },
    ],
  };
}

function createThreadContext() {
  return {
    repositoryId: "repo-1",
    worktreePath: "/repos/alpha/worktrees/feature",
    thread: {
      id: "thread-1",
      worktreeId: "/repos/alpha/worktrees/feature",
      title: "Pi",
      lastActivityAt: null,
      runtimeId: null,
      createdAt: 1,
      updatedAt: 1,
    },
    socketPath: "/tmp/thread.sock",
    runtimeId: "runtime-1",
    command: ["node", "session-server.mjs"],
    agentMode: "mock" as const,
    agentDirectory: "/repos/alpha/worktrees/feature/.pi/agent",
    runtimeAgentDirectory:
      "/repos/alpha/worktrees/feature/.pi/agent/threads/thread-1",
  };
}

function createWorkspaceSession(worktreeId: string): WorkspaceSession {
  return {
    worktreeId,
    layout: {
      windows: [],
      nextZIndex: 1,
      focusedWindowId: null,
      snapGridSize: 24,
      zoom: 1,
      panX: 0,
      panY: 0,
    },
    sidebar: { activePanel: "files", isCollapsed: false },
    promptDrafts: {},
    search: { query: "", selectedPath: null },
    files: {},
    notes: {},
    recoveryDrafts: {},
  };
}

describe("createShellStateIpcDependencies", () => {
  it("builds shell snapshot state and preserves distinct allowed path lists", async () => {
    const currentHost = {
      getSnapshot: vi.fn().mockResolvedValue({
        sessionId: "session-1",
        status: "ready",
        messages: [],
        lastError: null,
      }),
    };
    const currentContext = createThreadContext();
    const selectionState = {
      get: vi.fn(() => ({
        repositoryId: "repo-fallback",
        worktreeId: "/repos/fallback",
        threadId: null,
      })),
      replace: vi.fn(),
    };
    const repositories = [
      {
        id: "repo-1",
        rootPath: "/repos/alpha",
        label: null,
        order: 0,
        lastSelectedWorktreeId: "/repos/alpha/worktrees/feature",
        addedAt: 1,
        updatedAt: 1,
      },
      {
        id: "repo-2",
        rootPath: "/repos/beta",
        label: null,
        order: 1,
        lastSelectedWorktreeId: null,
        addedAt: 2,
        updatedAt: 2,
      },
    ];
    const repositoryCatalog = {
      list: vi.fn(() => repositories),
    };
    const repositoryPreferencesCatalog = {
      list: vi.fn(() => []),
    };
    const workspaceSessionCatalog = {
      list: vi.fn(() => [
        createWorkspaceSession("/repos/alpha/worktrees/feature"),
      ]),
      replaceAll: vi.fn(),
    };
    const gitService = {
      inspect: vi.fn((rootPath: string) => createInspection(rootPath)),
      inspectAsync: vi.fn(async (rootPath: string) =>
        createInspection(rootPath),
      ),
    };
    const threadCatalog = {
      listByWorktree: vi.fn(() => []),
    };
    const runtimeManager = {
      getRuntimeState: vi.fn(async () => ({
        threadId: "thread-1",
        worktreePath: "/repos/alpha/worktrees/feature",
        runtimeId: "runtime-1",
        status: "ready" as const,
        lastError: null,
      })),
    };
    const createShellSnapshot = vi.fn((input) => ({
      appName: input.appName,
      appVersion: input.appVersion,
      chromeVersion: input.chromeVersion,
      platform: input.platform,
      mode: "test" as const,
      runtime: {
        agentMode: input.agentMode,
        electronVersion: input.electronVersion,
        agentDirectory: input.agentDir ?? null,
      },
      workspace: {
        rootPath: input.cwd ?? null,
        agentDirectory: input.agentDir ?? null,
        projects: [],
      },
      catalog: input.catalog,
      capabilities: {
        supportsTurns: true,
        supportsTools: true,
        supportsActivity: true,
        supportsParallelSessions: false,
      },
      git: null,
    }));

    const shellState = createShellStateIpcDependencies({
      appName: "Pi Desktop",
      appVersion: "1.2.3",
      chromeVersion: "123.0.0.0",
      electronVersion: "37.0.0",
      platform: "darwin",
      env: { NODE_ENV: "test" },
      isPackaged: false,
      preferredWorkspacePath: "/repos/preferred",
      getCurrentHost: () => currentHost,
      getCurrentContext: () => currentContext,
      selectionState,
      repositoryCatalog,
      repositoryPreferencesCatalog,
      workspaceSessionCatalog,
      gitService,
      threadCatalog,
      runtimeManager,
      createShellSnapshot,
    });

    const snapshot = await shellState.getShellSnapshot();

    expect(currentHost.getSnapshot).toHaveBeenCalledTimes(1);
    expect(createShellSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: "Pi Desktop",
        appVersion: "1.2.3",
        chromeVersion: "123.0.0.0",
        electronVersion: "37.0.0",
        platform: "darwin",
        env: { NODE_ENV: "test" },
        isPackaged: false,
        cwd: "/repos/alpha/worktrees/feature",
        agentDir: "/repos/alpha/worktrees/feature/.pi/agent",
        agentMode: "mock",
        agentSnapshot: {
          sessionId: "session-1",
          status: "ready",
          messages: [],
          lastError: null,
        },
      }),
    );
    expect(snapshot.workspace?.rootPath).toBe("/repos/alpha/worktrees/feature");
    expect(selectionState.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: "repo-1",
        worktreeId: "/repos/alpha/worktrees/feature",
        threadId: null,
      }),
    );
    expect(workspaceSessionCatalog.replaceAll).toHaveBeenCalledWith([
      expect.objectContaining({ worktreeId: "/repos/alpha/worktrees/feature" }),
    ]);

    expect(shellState.getWorkspaceRootPath()).toBe(
      "/repos/alpha/worktrees/feature",
    );
    expect(shellState.getAllowedRepositoryRoots()).toEqual([
      "/repos/alpha",
      "/repos/alpha/worktrees/feature",
      "/repos/beta",
      "/repos/beta/worktrees/feature",
    ]);
    expect(shellState.getAllowedTerminalCwds()).toEqual([
      "/repos/alpha",
      "/repos/alpha",
      "/repos/alpha/worktrees/feature",
      "/repos/beta",
      "/repos/beta",
      "/repos/beta/worktrees/feature",
    ]);

    gitService.inspect.mockImplementation((rootPath: string) =>
      rootPath === "/repos/beta"
        ? createRootOnlyInspection(rootPath)
        : createInspection(rootPath),
    );

    expect(shellState.getAllowedRepositoryRoots()).toEqual([
      "/repos/alpha",
      "/repos/alpha/worktrees/feature",
      "/repos/beta",
    ]);
    expect(shellState.getAllowedTerminalCwds()).toEqual([
      "/repos/alpha",
      "/repos/alpha",
      "/repos/alpha/worktrees/feature",
      "/repos/beta",
      "/repos/beta",
    ]);
  });

  it("falls back to a bootstrap error snapshot when the host snapshot read fails", async () => {
    const createShellSnapshot = vi.fn((input) => ({
      appName: input.appName,
      appVersion: input.appVersion,
      chromeVersion: input.chromeVersion,
      platform: input.platform,
      mode: "test" as const,
      catalog: input.catalog,
      runtime: {
        agentMode: input.agentMode,
        electronVersion: input.electronVersion,
        agentDirectory: input.agentDir ?? null,
      },
      workspace: {
        rootPath: input.cwd ?? null,
        agentDirectory: input.agentDir ?? null,
        projects: [],
      },
      capabilities: {
        supportsTurns: true,
        supportsTools: true,
        supportsActivity: true,
        supportsParallelSessions: false,
      },
      git: null,
    }));

    const shellState = createShellStateIpcDependencies({
      appName: "Pi Desktop",
      appVersion: "1.2.3",
      chromeVersion: "123.0.0.0",
      electronVersion: "37.0.0",
      platform: "darwin",
      env: { NODE_ENV: "test" },
      isPackaged: false,
      preferredWorkspacePath: "/repos/preferred",
      getCurrentHost: () => ({
        getSnapshot: vi.fn().mockRejectedValue(new Error("host down")),
      }),
      getCurrentContext: () => null,
      selectionState: {
        get: vi.fn(() => ({
          repositoryId: null,
          worktreeId: null,
          threadId: null,
        })),
        replace: vi.fn(),
      },
      repositoryCatalog: {
        list: vi.fn(() => []),
      },
      repositoryPreferencesCatalog: {
        list: vi.fn(() => []),
      },
      workspaceSessionCatalog: {
        list: vi.fn(() => []),
        replaceAll: vi.fn(),
      },
      gitService: {
        inspect: vi.fn(() => ({
          status: "not_repo" as const,
          message: null,
        })),
        inspectAsync: vi.fn(async () => ({
          status: "not_repo" as const,
          message: null,
        })),
      },
      threadCatalog: {
        listByWorktree: vi.fn(() => []),
      },
      runtimeManager: {
        getRuntimeState: vi.fn(async () => ({
          threadId: "thread-1",
          worktreePath: "/repos/alpha/worktrees/feature",
          runtimeId: "runtime-1",
          status: "ready" as const,
          lastError: null,
        })),
      },
      createShellSnapshot,
    });

    await shellState.getShellSnapshot();

    expect(createShellSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/repos/preferred",
        agentSnapshot: {
          sessionId: "bootstrap-error",
          status: "error",
          messages: [],
          lastError: "getSnapshot: host down",
        },
      }),
    );
  });
});
