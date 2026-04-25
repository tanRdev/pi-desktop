import type {
  AgentSnapshot,
  RepositoryPreferences,
  ShellSnapshot,
  WorkspaceSession,
} from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_UNTITLED_THREAD_TITLE,
  generateThreadTitleFromMessage,
} from "../../thread-title-defaults";

import {
  createAgentIpcHost,
  createDesktopIpcHandlerDependencies,
} from "./ipc-registration";

function createAgentSnapshot(sessionId: string): AgentSnapshot {
  return {
    sessionId,
    status: "ready",
    messages: [],
    lastError: null,
  };
}

function createShellSnapshot(): ShellSnapshot {
  return {
    appName: "Pi Desktop",
    appVersion: "1.0.0",
    platform: "darwin",
    chromeVersion: "136.0.0.0",
    mode: "development",
    catalog: {
      repositories: [],
      selection: {
        repositoryId: null,
        worktreeId: null,
        threadId: null,
      },
      reconciledWorkspaceSessions: [],
    },
  };
}

function createRepositoryPreferences(
  repositoryId: string,
): RepositoryPreferences {
  return {
    repositoryId,
    customName: null,
    icon: null,
    accentColor: null,
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
    sidebar: { activePanel: null, isCollapsed: false },
    promptDrafts: {},
    search: { query: "", selectedPath: null },
    files: {},
    notes: {},
    recoveryDrafts: {},
  };
}

describe("ipc-registration", () => {
  it("renames untitled threads before prompting the active host", async () => {
    const prompt = vi.fn(async () => undefined);
    const threadCatalog = {
      get: vi.fn(() => ({
        id: "thread-1",
        worktreeId: "/repo",
        title: DEFAULT_UNTITLED_THREAD_TITLE,
        archivedAt: null,
        lastActivityAt: null,
        runtimeId: null,
        createdAt: 1,
        updatedAt: 1,
      })),
      rename: vi.fn(),
      listByWorktree: vi.fn(() => []),
      delete: vi.fn(),
    };
    const notifySessionChanged = vi.fn();

    const agentHost = createAgentIpcHost({
      getCurrentContext: () => ({
        repositoryId: "repo-1",
        worktreePath: "/repo",
        thread: {
          id: "thread-1",
          worktreeId: "/repo",
          title: DEFAULT_UNTITLED_THREAD_TITLE,
          lastActivityAt: null,
          runtimeId: null,
          createdAt: 1,
          updatedAt: 1,
        },
        socketPath: "/tmp/thread.sock",
        runtimeId: null,
        command: ["node", "server.mjs"],
        agentMode: "mock",
        agentDirectory: "/repo/.pi/agent",
        runtimeAgentDirectory: "/repo/.pi/agent/runtime",
      }),
      getSelectedRepositoryId: () => "repo-1",
      getSelectedThreadId: () => "thread-1",
      getCurrentHost: () => ({
        getProviders: async () => [],
        getSettings: async () => ({}),
        getSnapshot: async () => createAgentSnapshot("session-1"),
        prompt,
        cancelPrompt: async () => undefined,
        reset: async () => undefined,
      }),
      threadCatalog,
      notifySessionChanged,
      repositoryCatalog: {
        get: vi.fn(() => null),
        reorder: vi.fn(),
        upsert: vi.fn(),
      },
      workspaceRemovalActions: {
        removeRepository: vi.fn(async () => undefined),
        removeWorktree: vi.fn(async () => undefined),
      },
      switchRepositoryPath: vi.fn(async () => undefined),
      shellOpenPath: vi.fn(async () => ""),
      createWorktreeContext: vi.fn(async () => null),
      switchContextInBackground: vi.fn(),
      resolveDefaultThreadContext: vi.fn(async () => null),
      getRepositoryIdForWorktree: vi.fn(() => "repo-1"),
      selectWorktreeWithoutThread: vi.fn(),
      threadWorkspaceActions: {
        createThread: vi.fn(async () => "thread-2"),
        selectThread: vi.fn(async () => undefined),
      },
      inspectWorktreeOrThrow: vi.fn(),
      buildThreadContext: vi.fn(),
    });

    await agentHost.prompt("Summarize the latest release notes");

    expect(threadCatalog.rename).toHaveBeenCalledWith(
      "thread-1",
      generateThreadTitleFromMessage("Summarize the latest release notes"),
    );
    expect(notifySessionChanged).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith("Summarize the latest release notes");
  });

  it("assembles sanitized IPC dependencies through the bootstrap helper", () => {
    const sanitizedHandle = vi.fn();
    const createSanitizingHandle = vi.fn(() => sanitizedHandle);
    const rawHandle = vi.fn();
    const getShellSnapshot = vi.fn(async () => createShellSnapshot());
    const getWorkspaceRootPath = vi.fn(() => "/repo");
    const getAllowedRepositoryRoots = vi.fn(() => ["/repo"] as const);
    const getAllowedTerminalCwds = vi.fn(() => ["/repo"] as const);

    const dependencies = createDesktopIpcHandlerDependencies({
      handle: rawHandle,
      createSanitizingHandle,
      logIpcError: vi.fn(),
      shellStateIpc: {
        getShellSnapshot,
        getWorkspaceRootPath,
        getAllowedRepositoryRoots,
        getAllowedTerminalCwds,
      },
      agentHost: {
        getProviders: async () => [],
        getSettings: async () => ({}),
        getSnapshot: async () => createAgentSnapshot("session-1"),
        prompt: async () => undefined,
        cancelPrompt: async () => undefined,
        reset: async () => undefined,
        addRepository: async () => undefined,
        reorderRepositories: async () => undefined,
        selectRepository: async () => undefined,
        removeRepository: async () => undefined,
        openRepositoryInFinder: async () => undefined,
        createWorktree: async () => undefined,
        selectWorktree: async () => undefined,
        removeWorktree: async () => undefined,
        createThread: async () => "thread-1",
        selectThread: async () => undefined,
        deleteThread: async () => undefined,
      },
      stateHost: {
        getRepositoryPreferences: async () =>
          createRepositoryPreferences("/repo"),
        updateRepositoryPreferences: async () =>
          createRepositoryPreferences("/repo"),
        getWorkspaceSession: async () => createWorkspaceSession("/repo"),
        saveWorkspaceSession: async () => createWorkspaceSession("/repo"),
        getAppPreferences: async () => ({ leftSidebarWidth: 320, ai: null }),
        updateAppPreferences: async () => ({ leftSidebarWidth: 320, ai: null }),
        importLegacyPreferences: async () => ({
          repositoryPreferences: [],
          appPreferences: { leftSidebarWidth: 320, ai: null },
        }),
      },
      mainWindow: null,
      gitService: {} as never,
      searchFiles: vi.fn(),
      switchModel: vi.fn(),
      getOAuthProviders: vi.fn(),
      loginWithOAuth: vi.fn(),
      logoutOAuth: vi.fn(),
      getDiscovery: vi.fn(),
      getSlashSuggestions: vi.fn(),
      threadCatalog: {} as never,
      packagesService: {} as never,
    });

    expect(createSanitizingHandle).toHaveBeenCalledWith(rawHandle, {
      log: expect.any(Function),
    });
    expect(dependencies.handle).toBe(sanitizedHandle);
    expect(dependencies.getShellSnapshot).toBe(getShellSnapshot);
    expect(dependencies.getWorkspaceRootPath).toBe(getWorkspaceRootPath);
    expect(dependencies.getAllowedRepositoryRoots).toBe(
      getAllowedRepositoryRoots,
    );
    expect(dependencies.getAllowedTerminalCwds).toBe(getAllowedTerminalCwds);
    expect(dependencies.agentHost).toBeDefined();
    expect(dependencies.stateHost).toBeDefined();
  });
});
