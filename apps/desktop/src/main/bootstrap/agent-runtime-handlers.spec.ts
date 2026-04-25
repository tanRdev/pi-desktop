import type {
  AutocompleteContext,
  ModelSwitchRequest,
  SearchRequest,
} from "@pi-desktop/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectedThreadContext } from "./thread-context";

const discoverPiResources = vi.fn();
const getPiSlashSuggestions = vi.fn();
const getOAuthProvidersForAgentDir = vi.fn();
const loginWithOAuthForAgentDir = vi.fn();
const logoutOAuthForAgentDir = vi.fn();
const switchModelForContext = vi.fn();

vi.mock("../pi-resource-discovery", () => ({
  discoverPiResources,
  getPiSlashSuggestions,
}));

vi.mock("../pi-oauth-service", () => ({
  getOAuthProvidersForAgentDir,
  loginWithOAuthForAgentDir,
  logoutOAuthForAgentDir,
}));

vi.mock("./model-switch", () => ({
  switchModelForContext,
}));

function createThreadEntry(threadId: string, worktreeId: string) {
  return {
    id: threadId,
    worktreeId,
    title: "Thread",
    lastActivityAt: null,
    runtimeId: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createSelectedThreadContext(
  worktreePath: string,
): SelectedThreadContext {
  return {
    repositoryId: "repo-1",
    worktreePath,
    thread: createThreadEntry("thread-1", worktreePath),
    socketPath: "/tmp/repo.sock",
    runtimeId: "runtime-1",
    command: ["node", "server.mjs"],
    agentMode: "mock",
    agentDirectory: "/tmp/repo/.pi/agent",
    runtimeAgentDirectory: "/tmp/repo/.pi/agent/runtime",
  };
}

describe("createAgentRuntimeHandlers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("switches the live runtime model and notifies the session on success", async () => {
    const { createAgentRuntimeHandlers } = await import(
      "./agent-runtime-handlers"
    );

    const request: ModelSwitchRequest = {
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
    };
    const currentContext = createSelectedThreadContext("/tmp/repo");
    const currentHost = {
      switchModel: vi.fn().mockResolvedValue(undefined),
    };
    const notifySessionChanged = vi.fn();

    const handlers = createAgentRuntimeHandlers({
      getCurrentContext: () => currentContext,
      getCurrentHost: () => currentHost,
      getSelectionState: () => ({
        repositoryId: "repo-1",
        worktreeId: "/tmp/repo",
        threadId: "thread-1",
      }),
      defaultAgentDirectory: "/Users/test/.pi/agent",
      getProcessCwd: () => "/fallback/cwd",
      createSettingsManager: vi.fn(),
      runtimeManager: { restartThreadRuntime: vi.fn() },
      attachContext: vi.fn(),
      commitAttachment: vi.fn(),
      workspaceSearchService: { search: vi.fn() },
      oauthPromptBridge: {
        openExternal: vi.fn(),
        requestInput: vi.fn(),
      },
      notifySessionChanged,
    });

    await handlers.handleSwitchModel(request);

    expect(currentHost.switchModel).toHaveBeenCalledWith(request);
    expect(notifySessionChanged).toHaveBeenCalledTimes(1);
    expect(switchModelForContext).not.toHaveBeenCalled();
  });

  it("falls back through switchModelForContext when the active runtime does not support live model switching", async () => {
    const { createAgentRuntimeHandlers } = await import(
      "./agent-runtime-handlers"
    );

    const request: ModelSwitchRequest = {
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
    };
    const currentContext = createSelectedThreadContext("/tmp/repo");
    const currentHost = {
      switchModel: vi.fn(async () => {
        throw new Error(
          "Model switching is not supported by the active Pi runtime",
        );
      }),
    };
    const notifySessionChanged = vi.fn();
    const createSettingsManager = vi.fn();
    const runtimeManager = { restartThreadRuntime: vi.fn() };
    const attachContext = vi.fn();
    const commitAttachment = vi.fn();

    const handlers = createAgentRuntimeHandlers({
      getCurrentContext: () => currentContext,
      getCurrentHost: () => currentHost,
      getSelectionState: () => ({
        repositoryId: "repo-1",
        worktreeId: "/tmp/repo",
        threadId: "thread-1",
      }),
      defaultAgentDirectory: "/Users/test/.pi/agent",
      getProcessCwd: () => "/fallback/cwd",
      createSettingsManager,
      runtimeManager,
      attachContext,
      commitAttachment,
      workspaceSearchService: { search: vi.fn() },
      oauthPromptBridge: {
        openExternal: vi.fn(),
        requestInput: vi.fn(),
      },
      notifySessionChanged,
    });

    await handlers.handleSwitchModel(request);

    expect(notifySessionChanged).not.toHaveBeenCalled();
    expect(switchModelForContext).toHaveBeenCalledWith(request, {
      currentContext,
      currentHost,
      resolveAgentDirectory: expect.any(Function),
      createSettingsManager,
      runtimeManager,
      attachContext,
      commitAttachment,
    });

    const fallbackDeps = switchModelForContext.mock.calls[0]?.[1];
    expect(fallbackDeps.resolveAgentDirectory()).toBe(
      "/tmp/repo/.pi/agent/runtime",
    );
  });

  it("uses the same agent directory and cwd resolution for discovery, slash suggestions, and oauth operations", async () => {
    const { createAgentRuntimeHandlers } = await import(
      "./agent-runtime-handlers"
    );

    discoverPiResources.mockReturnValue({
      isInstalled: true,
      skills: [],
      commands: [],
    });
    getPiSlashSuggestions.mockReturnValue({
      kind: "slash",
      suggestions: [],
      hasMore: false,
    });
    getOAuthProvidersForAgentDir.mockResolvedValue([]);
    loginWithOAuthForAgentDir.mockResolvedValue(undefined);
    logoutOAuthForAgentDir.mockResolvedValue(undefined);

    const notifySessionChanged = vi.fn();
    const context: AutocompleteContext = {
      text: "/hel",
      cursorPosition: 4,
      query: "hel",
      trigger: "/",
    };

    const handlers = createAgentRuntimeHandlers({
      getCurrentContext: () =>
        createSelectedThreadContext("/tmp/repo/worktrees/feature"),
      getCurrentHost: () => ({
        switchModel: vi.fn(),
      }),
      getSelectionState: () => ({
        repositoryId: "repo-1",
        worktreeId: "/tmp/repo/selected",
        threadId: "thread-1",
      }),
      defaultAgentDirectory: "/Users/test/.pi/agent",
      getProcessCwd: () => "/fallback/cwd",
      createSettingsManager: vi.fn(),
      runtimeManager: { restartThreadRuntime: vi.fn() },
      attachContext: vi.fn(),
      commitAttachment: vi.fn(),
      workspaceSearchService: { search: vi.fn() },
      oauthPromptBridge: {
        openExternal: vi.fn(),
        requestInput: vi.fn(),
      },
      notifySessionChanged,
    });

    await expect(handlers.handleGetDiscovery()).resolves.toEqual({
      isInstalled: true,
      skills: [],
      commands: [],
    });
    await expect(handlers.handleGetSlashSuggestions(context)).resolves.toEqual({
      kind: "slash",
      suggestions: [],
      hasMore: false,
    });
    await expect(handlers.handleGetOAuthProviders()).resolves.toEqual([]);

    await handlers.handleLoginWithOAuth("github");
    await handlers.handleLogoutOAuth("github");

    expect(discoverPiResources).toHaveBeenCalledWith(
      "/tmp/repo/.pi/agent/runtime",
      "/tmp/repo/worktrees/feature",
    );
    expect(getPiSlashSuggestions).toHaveBeenCalledWith({
      agentDir: "/tmp/repo/.pi/agent/runtime",
      cwd: "/tmp/repo/worktrees/feature",
      context,
    });
    expect(getOAuthProvidersForAgentDir).toHaveBeenCalledWith(
      "/tmp/repo/.pi/agent/runtime",
    );
    expect(loginWithOAuthForAgentDir).toHaveBeenCalledWith(
      "/tmp/repo/.pi/agent/runtime",
      "github",
      expect.any(Object),
    );
    expect(logoutOAuthForAgentDir).toHaveBeenCalledWith(
      "/tmp/repo/.pi/agent/runtime",
      "github",
    );
    expect(notifySessionChanged).toHaveBeenCalledTimes(2);
  });

  it("falls back to the selected worktree and process cwd when no active context exists", async () => {
    const { createAgentRuntimeHandlers } = await import(
      "./agent-runtime-handlers"
    );

    discoverPiResources.mockReturnValue({
      isInstalled: false,
      skills: [],
      commands: [],
    });
    getPiSlashSuggestions.mockReturnValue({
      kind: "slash",
      suggestions: [],
      hasMore: false,
    });

    const handlers = createAgentRuntimeHandlers({
      getCurrentContext: () => null,
      getCurrentHost: () => ({
        switchModel: vi.fn(),
      }),
      getSelectionState: () => ({
        repositoryId: "repo-1",
        worktreeId: "/tmp/repo/from-selection",
        threadId: null,
      }),
      defaultAgentDirectory: "/Users/test/.pi/agent",
      getProcessCwd: () => "/fallback/cwd",
      createSettingsManager: vi.fn(),
      runtimeManager: { restartThreadRuntime: vi.fn() },
      attachContext: vi.fn(),
      commitAttachment: vi.fn(),
      workspaceSearchService: { search: vi.fn() },
      oauthPromptBridge: {
        openExternal: vi.fn(),
        requestInput: vi.fn(),
      },
      notifySessionChanged: vi.fn(),
    });

    await handlers.handleGetDiscovery();

    expect(discoverPiResources).toHaveBeenCalledWith(
      "/Users/test/.pi/agent",
      "/tmp/repo/from-selection",
    );
  });

  it("delegates file search directly to WorkspaceSearchService.search", async () => {
    const { createAgentRuntimeHandlers } = await import(
      "./agent-runtime-handlers"
    );

    const request: SearchRequest = {
      query: "button",
      rootPath: "/tmp/repo",
      includePatterns: ["src/**"],
      excludePatterns: ["dist/**"],
      maxResults: 25,
    };
    const response = {
      query: "button",
      results: [],
      total: 0,
      duration: 2,
    };
    const search = vi.fn().mockResolvedValue(response);
    const handlers = createAgentRuntimeHandlers({
      getCurrentContext: () => null,
      getCurrentHost: () => ({
        switchModel: vi.fn(),
      }),
      getSelectionState: () => ({
        repositoryId: null,
        worktreeId: null,
        threadId: null,
      }),
      defaultAgentDirectory: "/Users/test/.pi/agent",
      getProcessCwd: () => "/fallback/cwd",
      createSettingsManager: vi.fn(),
      runtimeManager: { restartThreadRuntime: vi.fn() },
      attachContext: vi.fn(),
      commitAttachment: vi.fn(),
      workspaceSearchService: { search },
      oauthPromptBridge: {
        openExternal: vi.fn(),
        requestInput: vi.fn(),
      },
      notifySessionChanged: vi.fn(),
    });

    await expect(handlers.handleSearchFiles(request)).resolves.toBe(response);
    expect(search).toHaveBeenCalledWith(request);
  });
});
