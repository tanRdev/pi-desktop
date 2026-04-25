import { describe, expect, it, vi } from "vitest";

import { createThreadContextActions } from "./thread-context-actions";

function createThread(id: string, worktreeId: string) {
  return {
    id,
    worktreeId,
    title: `Thread ${id}`,
    lastActivityAt: null,
    runtimeId: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("createThreadContextActions", () => {
  it("preserves empty-worktree selection when createIfMissing is false", async () => {
    const inspectWorktreeOrThrow = vi.fn(() => ({
      rootPath: "/tmp/repo",
      currentWorktreePath: "/tmp/repo/worktrees/feature",
      worktrees: [],
      defaultBranch: "main",
    }));
    const upsertRepository = vi.fn(() => ({
      id: "repo-1",
      rootPath: "/tmp/repo",
    }));
    const setLastSelectedWorktree = vi.fn();
    const replaceSelection = vi.fn();
    const createThreadEntry = vi.fn(() =>
      createThread("thread-new", "/tmp/repo/worktrees/feature"),
    );

    const actions = createThreadContextActions({
      inspectWorktreeOrThrow,
      upsertRepository,
      getRepository: vi.fn(),
      setLastSelectedWorktree,
      replaceSelection,
      listThreadsByWorktree: vi.fn(() => []),
      createThread: createThreadEntry,
      getDefaultThreadTitle: () => "Pi",
      buildThreadContext: vi.fn(),
      environment: { NODE_ENV: "test" },
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      ensureDirectory: vi.fn(),
      resolveRuntimeOptions: vi.fn(() => ({
        mode: "mock" as const,
        cwd: "/tmp/repo/worktrees/feature",
        agentDir: "/tmp/repo/worktrees/feature/.pi/agent",
      })),
      createLaunchDetails: vi.fn(() => ({
        socketPath: "/tmp/pi-desktop/thread.sock",
        runtimeId: "runtime-1",
        command: ["node", "/tmp/session-server.mjs"],
      })),
      getHomePath: () => "/Users/test",
      isRepository: vi.fn(() => true),
      createWorktree: vi.fn(),
      ensureThreadRuntime: vi.fn(),
      restartThreadRuntime: vi.fn(),
      connectAgentHost: vi.fn(),
    });

    await expect(
      actions.resolveDefaultThreadContext("/tmp/repo/worktrees/feature", {
        createIfMissing: false,
      }),
    ).resolves.toBeNull();

    expect(setLastSelectedWorktree).toHaveBeenCalledWith(
      "repo-1",
      "/tmp/repo/worktrees/feature",
    );
    expect(replaceSelection).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreeId: "/tmp/repo/worktrees/feature",
      threadId: null,
    });
    expect(createThreadEntry).not.toHaveBeenCalled();
  });

  it("builds a fast thread context with runtime launch details", () => {
    const ensureDirectory = vi.fn();
    const setLastSelectedWorktree = vi.fn();
    const replaceSelection = vi.fn();
    const thread = createThread("thread-1", "/tmp/repo/worktrees/feature");

    const actions = createThreadContextActions({
      inspectWorktreeOrThrow: vi.fn(),
      upsertRepository: vi.fn(() => ({ id: "repo-1", rootPath: "/tmp/repo" })),
      getRepository: vi.fn(),
      setLastSelectedWorktree,
      replaceSelection,
      listThreadsByWorktree: vi.fn(),
      createThread: vi.fn(),
      getDefaultThreadTitle: () => "Pi",
      buildThreadContext: vi.fn(),
      environment: { NODE_ENV: "test" },
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      ensureDirectory,
      resolveRuntimeOptions: vi.fn(() => ({
        mode: "mock" as const,
        cwd: "/tmp/repo/worktrees/feature",
        agentDir: "/tmp/repo/worktrees/feature/.pi/agent",
      })),
      createLaunchDetails: vi.fn(() => ({
        socketPath: "/tmp/pi-desktop/thread.sock",
        runtimeId: "runtime-1",
        agentDirectory:
          "/tmp/repo/worktrees/feature/.pi/agent/threads/thread-1",
        command: ["node", "/tmp/session-server.mjs"],
      })),
      getHomePath: () => "/Users/test",
      isRepository: vi.fn(() => true),
      createWorktree: vi.fn(),
      ensureThreadRuntime: vi.fn(),
      restartThreadRuntime: vi.fn(),
      connectAgentHost: vi.fn(),
    });

    expect(
      actions.buildFastThreadContext({
        repositoryId: "repo-1",
        worktreePath: "/tmp/repo/worktrees/feature",
        thread,
      }),
    ).toEqual({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread,
      socketPath: "/tmp/pi-desktop/thread.sock",
      runtimeId: "runtime-1",
      command: ["node", "/tmp/session-server.mjs"],
      agentMode: "mock",
      agentDirectory: "/tmp/repo/worktrees/feature/.pi/agent",
      runtimeAgentDirectory:
        "/tmp/repo/worktrees/feature/.pi/agent/threads/thread-1",
    });

    expect(ensureDirectory).toHaveBeenCalledWith(
      "/tmp/repo/worktrees/feature/.pi/agent",
      {
        recursive: true,
      },
    );
    expect(setLastSelectedWorktree).toHaveBeenCalledWith(
      "repo-1",
      "/tmp/repo/worktrees/feature",
    );
    expect(replaceSelection).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreeId: "/tmp/repo/worktrees/feature",
      threadId: "thread-1",
    });
  });

  it("restarts the runtime before retrying a failed host attachment", async () => {
    const context = {
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: createThread("thread-1", "/tmp/repo/worktrees/feature"),
      socketPath: "/tmp/pi-desktop/thread.sock",
      runtimeId: "runtime-1",
      command: ["node", "/tmp/session-server.mjs"],
      agentMode: "mock" as const,
      agentDirectory: "/tmp/repo/worktrees/feature/.pi/agent",
      runtimeAgentDirectory:
        "/tmp/repo/worktrees/feature/.pi/agent/threads/thread-1",
    };
    const ensureThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const restartThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const connectAgentHost = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect failed"))
      .mockResolvedValueOnce({
        host: { id: "host-1" },
        transport: { close: vi.fn() },
      });

    const actions = createThreadContextActions({
      inspectWorktreeOrThrow: vi.fn(),
      upsertRepository: vi.fn(() => ({ id: "repo-1", rootPath: "/tmp/repo" })),
      getRepository: vi.fn(),
      setLastSelectedWorktree: vi.fn(),
      replaceSelection: vi.fn(),
      listThreadsByWorktree: vi.fn(),
      createThread: vi.fn(),
      getDefaultThreadTitle: () => "Pi",
      buildThreadContext: vi.fn(),
      environment: { NODE_ENV: "test" },
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      ensureDirectory: vi.fn(),
      resolveRuntimeOptions: vi.fn(() => ({
        mode: "mock" as const,
        cwd: "/tmp/repo/worktrees/feature",
        agentDir: "/tmp/repo/worktrees/feature/.pi/agent",
      })),
      createLaunchDetails: vi.fn(() => ({
        socketPath: "/tmp/pi-desktop/thread.sock",
        runtimeId: "runtime-1",
        command: ["node", "/tmp/session-server.mjs"],
      })),
      getHomePath: () => "/Users/test",
      isRepository: vi.fn(() => true),
      createWorktree: vi.fn(),
      ensureThreadRuntime,
      restartThreadRuntime,
      connectAgentHost,
    });

    await expect(actions.attachContext(context)).resolves.toEqual({
      context,
      host: { id: "host-1" },
      transport: expect.objectContaining({ close: expect.any(Function) }),
    });

    expect(ensureThreadRuntime).toHaveBeenCalledWith({
      threadId: "thread-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      command: ["node", "/tmp/session-server.mjs"],
    });
    expect(restartThreadRuntime).toHaveBeenCalledWith({
      threadId: "thread-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      command: ["node", "/tmp/session-server.mjs"],
    });
    expect(connectAgentHost).toHaveBeenCalledTimes(2);
    expect(connectAgentHost).toHaveBeenNthCalledWith(
      1,
      "/tmp/pi-desktop/thread.sock",
    );
    expect(connectAgentHost).toHaveBeenNthCalledWith(
      2,
      "/tmp/pi-desktop/thread.sock",
    );
  });

  it("creates a worktree context using the repository default branch and normalized branch path", async () => {
    const thread = createThread(
      "thread-1",
      "/Users/test/.pi-desktop/repo/feature-branch",
    );
    const buildThreadContext = vi.fn(() => ({
      repositoryId: "repo-1",
      worktreePath: "/Users/test/.pi-desktop/repo/feature-branch",
      thread,
      socketPath: "/tmp/pi-desktop/thread.sock",
      runtimeId: "runtime-1",
      command: ["node", "/tmp/session-server.mjs"],
      agentMode: "mock" as const,
      agentDirectory: "/tmp/repo/.pi/agent",
      runtimeAgentDirectory: "/tmp/repo/.pi/agent/threads/thread-1",
    }));
    const createWorktree = vi.fn(
      () => "/Users/test/.pi-desktop/repo/feature-branch",
    );

    const actions = createThreadContextActions({
      inspectWorktreeOrThrow: vi.fn((targetPath: string) => {
        if (targetPath === "/tmp/repo") {
          return {
            rootPath: "/tmp/repo",
            currentWorktreePath: "/tmp/repo",
            worktrees: [],
            defaultBranch: "main",
          };
        }

        return {
          rootPath: "/tmp/repo",
          currentWorktreePath: "/Users/test/.pi-desktop/repo/feature-branch",
          worktrees: [],
          defaultBranch: "main",
        };
      }),
      upsertRepository: vi.fn(() => ({ id: "repo-1", rootPath: "/tmp/repo" })),
      getRepository: vi.fn(() => ({ id: "repo-1", rootPath: "/tmp/repo" })),
      setLastSelectedWorktree: vi.fn(),
      replaceSelection: vi.fn(),
      listThreadsByWorktree: vi.fn(() => [thread]),
      createThread: vi.fn(),
      getDefaultThreadTitle: () => "Pi",
      buildThreadContext,
      environment: { NODE_ENV: "test" },
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      ensureDirectory: vi.fn(),
      resolveRuntimeOptions: vi.fn(() => ({
        mode: "mock" as const,
        cwd: "/tmp/repo",
        agentDir: "/tmp/repo/.pi/agent",
      })),
      createLaunchDetails: vi.fn(() => ({
        socketPath: "/tmp/pi-desktop/thread.sock",
        runtimeId: "runtime-1",
        command: ["node", "/tmp/session-server.mjs"],
      })),
      getHomePath: () => "/Users/test",
      isRepository: vi.fn(() => true),
      createWorktree,
      ensureThreadRuntime: vi.fn(),
      restartThreadRuntime: vi.fn(),
      connectAgentHost: vi.fn(),
    });

    await expect(
      actions.createWorktreeContext("repo-1", " feature/branch "),
    ).resolves.toEqual({
      repositoryId: "repo-1",
      worktreePath: "/Users/test/.pi-desktop/repo/feature-branch",
      thread,
      socketPath: "/tmp/pi-desktop/thread.sock",
      runtimeId: "runtime-1",
      command: ["node", "/tmp/session-server.mjs"],
      agentMode: "mock",
      agentDirectory: "/tmp/repo/.pi/agent",
      runtimeAgentDirectory: "/tmp/repo/.pi/agent/threads/thread-1",
    });

    expect(createWorktree).toHaveBeenCalledWith({
      repositoryRoot: "/tmp/repo",
      branchName: "feature/branch",
      worktreePath: "/Users/test/.pi-desktop/repo/feature-branch",
      baseBranch: "main",
    });
    expect(buildThreadContext).toHaveBeenCalledWith(
      "repo-1",
      expect.objectContaining({
        currentWorktreePath: "/Users/test/.pi-desktop/repo/feature-branch",
      }),
      thread,
    );
  });

  it("allows the bootstrap wrapper to preserve its shared default agent directory", () => {
    const createLaunchDetails = vi.fn(() => ({
      socketPath: "/tmp/pi-desktop/thread.sock",
      runtimeId: "runtime-1",
      agentDirectory: "/Users/test/.pi/agent/threads/thread-1",
      command: ["node", "/tmp/session-server.mjs"],
    }));

    const actions = createThreadContextActions({
      inspectWorktreeOrThrow: vi.fn(),
      upsertRepository: vi.fn(() => ({ id: "repo-1", rootPath: "/tmp/repo" })),
      getRepository: vi.fn(),
      setLastSelectedWorktree: vi.fn(),
      replaceSelection: vi.fn(),
      listThreadsByWorktree: vi.fn(),
      createThread: vi.fn(),
      getDefaultThreadTitle: () => "Pi",
      buildThreadContext: vi.fn(),
      environment: {
        NODE_ENV: "test",
        PI_DESKTOP_AGENT_DIR: "/Users/test/.pi/agent",
      },
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      ensureDirectory: vi.fn(),
      resolveRuntimeOptions: vi.fn(() => ({
        mode: "mock" as const,
        cwd: "/tmp/repo/worktrees/feature",
        agentDir: "/Users/test/.pi/agent",
      })),
      createLaunchDetails,
      getHomePath: () => "/Users/test",
      isRepository: vi.fn(() => true),
      createWorktree: vi.fn(),
      ensureThreadRuntime: vi.fn(),
      restartThreadRuntime: vi.fn(),
      connectAgentHost: vi.fn(),
    });

    actions.buildFastThreadContext({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: createThread("thread-1", "/tmp/repo/worktrees/feature"),
    });

    expect(createLaunchDetails).toHaveBeenCalledWith({
      threadId: "thread-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      mode: "mock",
      socketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      nodeEnv: "test",
      agentDirectory: "/Users/test/.pi/agent",
    });
  });
});
