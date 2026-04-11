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

  test("switchModelForContext preserves active-context validation and restart flow", async () => {
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
    const attachContext = vi.fn().mockResolvedValue({ attached: true });
    const commitAttachment = vi.fn();

    await expect(
      switchModelForContext(request, {
        currentContext: null,
        resolveAgentDirectory,
        createSettingsManager,
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
    expect(restartThreadRuntime).toHaveBeenCalledWith({
      threadId: "thread-1",
      worktreePath: "/tmp/project",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
    });
    expect(attachContext).toHaveBeenCalledWith(currentContext);
    expect(commitAttachment).toHaveBeenCalledWith({ attached: true });
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
      runtimeId: "pidesk-thread-runtime",
      socketPath: "/tmp/pidesk/thread.sock",
      agentDirectory: "/tmp/project/.pi/agent/threads/thread-1",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
    }));

    const thread = {
      id: "thread-1",
      worktreeId: "/tmp/project",
      title: "Current thread",
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
      runtimeSocketDirectory: "/tmp/pidesk/sockets",
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
      socketDirectory: "/tmp/pidesk/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      nodeEnv: "test",
      agentDirectory: "/tmp/project/.pi/agent",
    });
    expect(result).toEqual({
      repositoryId: "repo-1",
      worktreePath: "/tmp/project",
      thread,
      socketPath: "/tmp/pidesk/thread.sock",
      runtimeId: "pidesk-thread-runtime",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
      agentMode: "mock",
      agentDirectory: "/tmp/project/.pi/agent",
      runtimeAgentDirectory: "/tmp/project/.pi/agent/threads/thread-1",
    });
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
      socketPath: "/tmp/pidesk/thread-2.sock",
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
        title: "New thread",
        archivedAt: null,
        lastActivityAt: null,
        runtimeId: null,
        createdAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z",
      },
      environment: {},
      runtimeSocketDirectory: "/tmp/pidesk/sockets",
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
      socketDirectory: "/tmp/pidesk/sockets",
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
});
