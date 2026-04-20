import { describe, expect, test, vi } from "vitest";

describe("bootstrap helpers (RED)", () => {
  test("routePromptToTerminal preserves prompt validation and terminal-routing behavior", async () => {
    const { routePromptToTerminal } = await import(
      "../../../apps/desktop/src/main/bootstrap/route-to-terminal"
    );

    const write = vi.fn();
    const delay = vi.fn().mockResolvedValue(undefined);
    const getSessions = () => [
      {
        id: "shell-unlinked",
        backend: "shell" as const,
        cwd: "/tmp/project",
        status: "ready",
        ownerWindowId: "win-1",
        createdAt: 1,
      },
      {
        id: "shell-linked",
        backend: "shell" as const,
        cwd: "/tmp/project",
        status: "ready",
        ownerWindowId: "win-2",
        createdAt: 1,
        linkedThreadId: "thread-123",
      },
      {
        id: "pi-session",
        backend: "pi" as const,
        cwd: "/tmp/project",
        status: "ready",
        ownerWindowId: "win-3",
        createdAt: 1,
      },
    ];

    expect(
      await routePromptToTerminal(
        {
          terminalId: "shell-unlinked",
          prompt: "   ",
          startPiIfNotLinked: false,
        },
        {
          terminalManager: { getSessions, write },
          delay,
        },
      ),
    ).toEqual({ success: false, error: "Prompt must not be empty" });

    expect(
      await routePromptToTerminal(
        {
          terminalId: "missing-session",
          prompt: "hello",
          startPiIfNotLinked: false,
        },
        {
          terminalManager: { getSessions, write },
          delay,
        },
      ),
    ).toEqual({
      success: false,
      error: "Unknown terminal session: missing-session",
    });

    expect(
      await routePromptToTerminal(
        {
          terminalId: "shell-unlinked",
          prompt: "  hello world  ",
          startPiIfNotLinked: true,
        },
        {
          terminalManager: { getSessions, write },
          delay,
        },
      ),
    ).toEqual({ success: true, threadId: undefined });
    expect(write.mock.calls.slice(0, 2)).toEqual([
      ["shell-unlinked", "pi\n"],
      ["shell-unlinked", "hello world\n"],
    ]);
    expect(delay).toHaveBeenCalledWith(150);

    write.mockClear();
    delay.mockClear();

    expect(
      await routePromptToTerminal(
        {
          terminalId: "shell-linked",
          prompt: "ping",
          startPiIfNotLinked: true,
        },
        {
          terminalManager: { getSessions, write },
          delay,
        },
      ),
    ).toEqual({ success: true, threadId: "thread-123" });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("shell-linked", "ping\n");
    expect(delay).not.toHaveBeenCalled();
  });

  test("routePromptToTerminal remains a local helper and is not wired into desktop IPC", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).not.toContain("routePromptToTerminal");
  });

  test("switchModelForContext preserves active-context validation and prefers the live runtime switch", async () => {
    const { switchModelForContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/model-switch"
    );

    const request = {
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    const resolveAgentDirectory = vi.fn(() => "/tmp/project/.pi/agent");
    const createSettingsManager = vi.fn();
    const restartThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const hostSwitchModel = vi.fn().mockResolvedValue(undefined);
    const attachContext = vi.fn().mockResolvedValue({ attached: true });
    const commitAttachment = vi.fn();

    await expect(
      switchModelForContext(request, {
        currentContext: null,
        resolveAgentDirectory,
        createSettingsManager,
        currentHost: { switchModel: hostSwitchModel },
        runtimeManager: { restartThreadRuntime },
        attachContext,
        commitAttachment,
      }),
    ).rejects.toThrow("No active Pi context is selected");

    const setDefaultProvider = vi.fn().mockResolvedValue(undefined);
    const setDefaultModel = vi.fn().mockResolvedValue(undefined);
    createSettingsManager.mockResolvedValueOnce({
      setDefaultProvider,
      setDefaultModel,
    });

    const currentContext = {
      worktreePath: "/tmp/project",
      thread: { id: "thread-1" },
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
      agentDirectory: "/tmp/project/.pi/agent",
    };

    await switchModelForContext(request, {
      currentContext,
      resolveAgentDirectory,
      createSettingsManager,
      currentHost: { switchModel: hostSwitchModel },
      runtimeManager: { restartThreadRuntime },
      attachContext,
      commitAttachment,
    });

    expect(resolveAgentDirectory).toHaveBeenCalledTimes(1);
    expect(createSettingsManager).toHaveBeenCalledWith(
      "/tmp/project",
      "/tmp/project/.pi/agent",
    );
    expect(setDefaultProvider).toHaveBeenCalledWith("anthropic");
    expect(setDefaultModel).toHaveBeenCalledWith("claude-3-7-sonnet");
    expect(hostSwitchModel).toHaveBeenCalledWith({
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    });
    expect(restartThreadRuntime).not.toHaveBeenCalled();
    expect(attachContext).not.toHaveBeenCalled();
    expect(commitAttachment).not.toHaveBeenCalled();
  });

  test("switchModelForContext updates settings without restarting when no thread runtime is active", async () => {
    const { switchModelForContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/model-switch"
    );

    const request = {
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    const resolveAgentDirectory = vi.fn(() => "/tmp/project/.pi/agent");
    const setDefaultProvider = vi.fn().mockResolvedValue(undefined);
    const setDefaultModel = vi.fn().mockResolvedValue(undefined);
    const createSettingsManager = vi.fn().mockResolvedValue({
      setDefaultProvider,
      setDefaultModel,
    });
    const restartThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const hostSwitchModel = vi.fn(async () => {
      throw new Error(
        "Model switching is not supported by the active Pi runtime",
      );
    });
    const attachContext = vi.fn().mockResolvedValue({ attached: true });
    const commitAttachment = vi.fn();

    await switchModelForContext(request, {
      currentContext: {
        worktreePath: "/tmp/project",
        thread: { id: "pending-thread" },
        command: [],
      },
      resolveAgentDirectory,
      createSettingsManager,
      currentHost: { switchModel: hostSwitchModel },
      runtimeManager: { restartThreadRuntime },
      attachContext,
      commitAttachment,
    });

    expect(setDefaultProvider).toHaveBeenCalledWith("anthropic");
    expect(setDefaultModel).toHaveBeenCalledWith("claude-3-7-sonnet");
    expect(restartThreadRuntime).not.toHaveBeenCalled();
    expect(attachContext).not.toHaveBeenCalled();
    expect(commitAttachment).not.toHaveBeenCalled();
  });

  test("switchModelForContext writes defaults to the workspace agent directory before falling back", async () => {
    const { switchModelForContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/model-switch"
    );

    const request = {
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
    };
    const resolveAgentDirectory = vi.fn(() => "/tmp/project/.pi/agent");
    const setDefaultProvider = vi.fn().mockResolvedValue(undefined);
    const setDefaultModel = vi.fn().mockResolvedValue(undefined);
    const createSettingsManager = vi.fn().mockResolvedValue({
      setDefaultProvider,
      setDefaultModel,
    });
    const restartThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const attachContext = vi.fn().mockResolvedValue({ attached: true });
    const commitAttachment = vi.fn();

    await switchModelForContext(request, {
      currentContext: {
        worktreePath: "/tmp/project",
        thread: { id: "thread-1" },
        command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
      },
      resolveAgentDirectory,
      createSettingsManager,
      currentHost: {
        switchModel: vi.fn(async () => {
          throw new Error(
            "Model switching is not supported by the active Pi runtime",
          );
        }),
      },
      runtimeManager: { restartThreadRuntime },
      attachContext,
      commitAttachment,
    });

    expect(createSettingsManager).toHaveBeenCalledWith(
      "/tmp/project",
      "/tmp/project/.pi/agent",
    );
    expect(setDefaultProvider).toHaveBeenCalledWith("anthropic");
    expect(setDefaultModel).toHaveBeenCalledWith("claude-sonnet-4-20250514");
    expect(restartThreadRuntime).toHaveBeenCalledWith({
      threadId: "thread-1",
      worktreePath: "/tmp/project",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
    });
    expect(attachContext).toHaveBeenCalledTimes(1);
    expect(commitAttachment).toHaveBeenCalledWith({ attached: true });
  });

  test("buildThreadContext preserves repository selection, runtime options, and launch details", async () => {
    const { buildThreadContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/thread-context"
    );

    const repositoryCatalog = {
      setLastSelectedWorktree: vi.fn(),
    };
    const selectionState = {
      replace: vi.fn(),
    };
    const ensureDirectory = vi.fn();
    const resolveRuntimeOptions = vi.fn(() => ({
      mode: "mock" as const,
      cwd: "/tmp/project",
      agentDir: "/tmp/project/.pi/agent",
    }));
    const createLaunchDetails = vi.fn(() => ({
      threadId: "thread-1",
      worktreePath: "/tmp/project",
      runtimeId: "pi-desktop-thread-runtime",
      socketPath: "/tmp/pi-desktop/thread.sock",
      agentDirectory: "/tmp/project/.pi/agent/threads/thread-1",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
    }));

    const thread = {
      id: "thread-1",
      worktreeId: "/tmp/project",
      title: "North Star",
      archivedAt: null,
      lastActivityAt: null,
      runtimeId: null,
      createdAt: "2026-03-17T00:00:00.000Z",
      updatedAt: "2026-03-17T00:00:00.000Z",
    };

    const inspection = {
      rootPath: "/tmp/repo",
      currentWorktreePath: "/tmp/project",
      worktrees: [],
      defaultBranch: "main",
    };

    const result = buildThreadContext({
      repositoryId: "repo-1",
      inspection,
      thread,
      environment: { NODE_ENV: "test" },
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      repositoryCatalog,
      selectionState,
      ensureDirectory,
      resolveRuntimeOptions,
      createLaunchDetails,
    });

    expect(repositoryCatalog.setLastSelectedWorktree).toHaveBeenCalledWith(
      "repo-1",
      "/tmp/project",
    );
    expect(selectionState.replace).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreeId: "/tmp/project",
      threadId: "thread-1",
    });
    expect(resolveRuntimeOptions).toHaveBeenCalledWith(
      { NODE_ENV: "test" },
      "/tmp/project",
    );
    expect(ensureDirectory).toHaveBeenCalledWith("/tmp/project/.pi/agent", {
      recursive: true,
    });
    expect(createLaunchDetails).toHaveBeenCalledWith({
      threadId: "thread-1",
      worktreePath: "/tmp/project",
      mode: "mock",
      socketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      nodeEnv: "test",
      agentDirectory: "/tmp/project/.pi/agent",
    });
    expect(result).toEqual({
      repositoryId: "repo-1",
      worktreePath: "/tmp/project",
      thread,
      socketPath: "/tmp/pi-desktop/thread.sock",
      runtimeId: "pi-desktop-thread-runtime",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
      agentMode: "mock",
      agentDirectory: "/tmp/project/.pi/agent",
      runtimeAgentDirectory: "/tmp/project/.pi/agent/threads/thread-1",
    });
  });

  test("resolveWorkspaceInspection treats plain folders as thread-capable workspaces", async () => {
    const { resolveWorkspaceInspection } = await import(
      "../../../apps/desktop/src/main/bootstrap/workspace-inspection"
    );

    expect(
      resolveWorkspaceInspection("/tmp/folder-workspace", {
        status: "not_repo",
        message: null,
      }),
    ).toEqual({
      rootPath: "/tmp/folder-workspace",
      currentWorktreePath: "/tmp/folder-workspace",
      worktrees: [],
      defaultBranch: null,
    });

    expect(
      resolveWorkspaceInspection("/tmp/missing-workspace", {
        status: "unavailable",
        message: "boom",
      }),
    ).toBeNull();
  });

  test("buildThreadContext skips directory creation when agentDir is absent", async () => {
    const { buildThreadContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/thread-context"
    );

    const ensureDirectory = vi.fn();
    const createLaunchDetails = vi.fn(() => ({
      threadId: "thread-2",
      worktreePath: "/tmp/project",
      runtimeId: "thread-2-runtime",
      socketPath: "/tmp/pi-desktop/thread-2.sock",
      agentDirectory: "/tmp/project/.pi/agent/threads/thread-2",
      command: ["node", "/tmp/session-server.mjs"],
    }));

    const result = buildThreadContext({
      repositoryId: "repo-2",
      inspection: {
        rootPath: "/tmp/repo",
        currentWorktreePath: "/tmp/project",
        worktrees: [],
      },
      thread: {
        id: "thread-2",
        worktreeId: "/tmp/project",
        title: "Fresh Orbit",
        archivedAt: null,
        lastActivityAt: null,
        runtimeId: null,
        createdAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z",
      },
      environment: {},
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      repositoryCatalog: {
        setLastSelectedWorktree: vi.fn(),
      },
      selectionState: {
        replace: vi.fn(),
      },
      ensureDirectory,
      resolveRuntimeOptions: () => ({
        mode: "cli",
        cwd: "/tmp/project",
        agentDir: null,
      }),
      createLaunchDetails,
    });

    expect(ensureDirectory).not.toHaveBeenCalled();
    expect(createLaunchDetails).toHaveBeenCalledWith({
      threadId: "thread-2",
      worktreePath: "/tmp/project",
      mode: "cli",
      socketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      nodeEnv: undefined,
      agentDirectory: null,
    });
    expect(result.agentDirectory).toBeNull();
    expect(result.runtimeAgentDirectory).toBe(
      "/tmp/project/.pi/agent/threads/thread-2",
    );
    expect(result.agentMode).toBe("cli");
  });

  test("active thread archive and delete fall back to no selection instead of auto-creating a replacement", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).toContain(
      '"No active session is selected for this workspace"',
    );
    expect(source).toContain("threadId: null");
    expect(source).toContain(
      "switchContextInBackground(await resolveThreadContext(nextOpenThread.id));",
    );
  });

  test("workspace selection preserves empty workspaces until user explicitly creates a thread", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).toContain("createIfMissing: false");
    expect(source).toContain("selectWorktreeWithoutThread(");
    expect(source).toContain(
      "if (!thread && options.createIfMissing === false)",
    );
  });

  test("resolveInitialWorkspaceTarget keeps a fresh catalog empty instead of seeding process.cwd", async () => {
    const { resolveInitialWorkspaceTarget } = await import(
      "../../../apps/desktop/src/main/bootstrap/initial-workspace"
    );

    expect(
      resolveInitialWorkspaceTarget({
        selection: {
          repositoryId: null,
          worktreeId: null,
          threadId: null,
        },
        repositories: [],
      }),
    ).toEqual({
      preferredWorkspacePath: null,
      fallbackWorkspacePath: null,
      shouldPreserveEmptySelection: false,
    });

    expect(
      resolveInitialWorkspaceTarget({
        selection: {
          repositoryId: null,
          worktreeId: null,
          threadId: null,
        },
        repositories: [
          {
            id: "/tmp/repo-a",
            rootPath: "/tmp/repo-a",
            label: null,
            order: 0,
            lastSelectedWorktreeId: "/tmp/repo-a/worktrees/feature",
            addedAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    ).toEqual({
      preferredWorkspacePath: "/tmp/repo-a/worktrees/feature",
      fallbackWorkspacePath: null,
      shouldPreserveEmptySelection: false,
    });
  });
});
