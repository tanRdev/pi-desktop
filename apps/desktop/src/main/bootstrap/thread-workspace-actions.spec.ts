import { describe, expect, it, vi } from "vitest";

describe("createThreadWorkspaceActions", () => {
  it("uses the fast path when creating or selecting a thread in the active worktree", async () => {
    const { createThreadWorkspaceActions } = await import(
      "./thread-workspace-actions"
    );

    const createdThread = {
      id: "thread-2",
      worktreeId: "/tmp/repo/worktrees/feature",
      title: "Pi",
      lastActivityAt: null,
      runtimeId: null,
      createdAt: 1,
      updatedAt: 1,
    };
    const existingThread = {
      id: "thread-1",
      worktreeId: "/tmp/repo/worktrees/feature",
      title: "Existing",
      lastActivityAt: null,
      runtimeId: null,
      createdAt: 1,
      updatedAt: 1,
    };
    const buildFastThreadContext = vi.fn(({ thread }) => ({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread,
    }));
    const buildThreadContext = vi.fn();
    const inspectWorktreeOrThrow = vi.fn();
    const createThread = vi.fn(() => createdThread);
    const getThread = vi.fn((threadId: string) =>
      threadId === existingThread.id ? existingThread : null,
    );
    const switchContextInBackground = vi.fn();

    const actions = createThreadWorkspaceActions({
      getCurrentWorktreeId: () => "/tmp/repo/worktrees/feature",
      getRepositoryIdForWorktree: () => "repo-1",
      upsertRepository: vi.fn(() => ({ id: "repo-9" })),
      getDefaultThreadTitle: () => "Pi",
      createThread,
      getThread,
      inspectWorktreeOrThrow,
      buildThreadContext,
      buildFastThreadContext,
      switchContextInBackground,
    });

    await expect(
      actions.createThread("/tmp/repo/worktrees/feature/"),
    ).resolves.toBe("thread-2");

    expect(createThread).toHaveBeenCalledWith({
      worktreeId: "/tmp/repo/worktrees/feature",
      title: "Pi",
    });
    expect(buildFastThreadContext).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: createdThread,
    });
    expect(buildThreadContext).not.toHaveBeenCalled();
    expect(inspectWorktreeOrThrow).not.toHaveBeenCalled();
    expect(switchContextInBackground).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: createdThread,
    });

    switchContextInBackground.mockClear();
    buildFastThreadContext.mockClear();

    await actions.selectThread("thread-1");

    expect(buildFastThreadContext).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: existingThread,
    });
    expect(buildThreadContext).not.toHaveBeenCalled();
    expect(switchContextInBackground).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: existingThread,
    });
  });

  it("falls back to inspection-backed context resolution for other worktrees", async () => {
    const { createThreadWorkspaceActions } = await import(
      "./thread-workspace-actions"
    );

    const inspection = {
      rootPath: "/tmp/repo",
      currentWorktreePath: "/tmp/repo/worktrees/other",
      worktrees: [],
      defaultBranch: "main",
    };
    const existingThread = {
      id: "thread-4",
      worktreeId: "/tmp/repo/worktrees/other",
      title: "Elsewhere",
      lastActivityAt: null,
      runtimeId: null,
      createdAt: 1,
      updatedAt: 1,
    };
    const buildThreadContext = vi.fn(
      (repositoryId: string, resolvedInspection, thread) => ({
        repositoryId,
        worktreePath: resolvedInspection.currentWorktreePath,
        thread,
      }),
    );

    const actions = createThreadWorkspaceActions({
      getCurrentWorktreeId: () => "/tmp/repo/worktrees/feature",
      getRepositoryIdForWorktree: () => null,
      upsertRepository: vi.fn(({ rootPath }: { rootPath: string }) => ({
        id: `${rootPath}-repo`,
      })),
      getDefaultThreadTitle: () => "Pi",
      createThread: vi.fn(() => ({
        id: "thread-3",
        worktreeId: "/tmp/repo/worktrees/other",
        title: "Pi",
        lastActivityAt: null,
        runtimeId: null,
        createdAt: 1,
        updatedAt: 1,
      })),
      getThread: vi.fn((threadId: string) =>
        threadId === existingThread.id ? existingThread : null,
      ),
      inspectWorktreeOrThrow: vi.fn(() => inspection),
      buildThreadContext,
      buildFastThreadContext: vi.fn(),
      switchContextInBackground: vi.fn(),
    });

    await expect(
      actions.createThread("/tmp/repo/worktrees/other"),
    ).resolves.toBe("thread-3");
    await actions.selectThread("thread-4");

    expect(buildThreadContext).toHaveBeenNthCalledWith(
      1,
      "/tmp/repo-repo",
      inspection,
      expect.objectContaining({ id: "thread-3" }),
    );
    expect(buildThreadContext).toHaveBeenNthCalledWith(
      2,
      "/tmp/repo-repo",
      inspection,
      existingThread,
    );
  });

  it("throws when selecting an unknown thread", async () => {
    const { createThreadWorkspaceActions } = await import(
      "./thread-workspace-actions"
    );

    const actions = createThreadWorkspaceActions({
      getCurrentWorktreeId: () => null,
      getRepositoryIdForWorktree: () => null,
      upsertRepository: vi.fn(() => ({ id: "repo-1" })),
      getDefaultThreadTitle: () => "Pi",
      createThread: vi.fn(),
      getThread: vi.fn(() => null),
      inspectWorktreeOrThrow: vi.fn(),
      buildThreadContext: vi.fn(),
      buildFastThreadContext: vi.fn(),
      switchContextInBackground: vi.fn(),
    });

    await expect(actions.selectThread("missing-thread")).rejects.toThrowError(
      "Unknown thread: missing-thread",
    );
  });
});
