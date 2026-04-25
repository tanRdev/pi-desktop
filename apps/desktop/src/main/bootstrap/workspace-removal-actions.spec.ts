import { describe, expect, it, vi } from "vitest";

describe("createWorkspaceRemovalActions", () => {
  it("removes a repository, cleans related state, and activates the next repository when active", async () => {
    const { createWorkspaceRemovalActions } = await import(
      "./workspace-removal-actions"
    );

    const repository = {
      id: "repo-1",
      rootPath: "/repos/alpha",
    };
    const nextRepository = {
      id: "repo-2",
      rootPath: "/repos/beta",
      lastSelectedWorktreeId: "/repos/beta/worktrees/feature",
    };
    const listByWorktree = vi.fn((worktreeId: string) => {
      if (worktreeId === "/repos/alpha/worktrees/feature") {
        return [{ id: "thread-feature-1" }, { id: "thread-feature-2" }];
      }

      if (worktreeId === "/repos/alpha") {
        return [{ id: "thread-root" }];
      }

      return [];
    });
    const deleteThread = vi.fn();
    const removeWorkspaceSession = vi.fn();
    const removeWorktree = vi.fn();
    const runBestEffortRemoveWorktree = vi.fn(
      (input: { worktreePath: string; repositoryRoot: string }) => {
        removeWorktree(input);
      },
    );
    const removeRepository = vi.fn();
    const removeRepositoryPreferences = vi.fn();
    const clearSelection = vi.fn();
    const notifySessionChanged = vi.fn();
    const activateWorkspacePath = vi.fn().mockResolvedValue(undefined);

    const actions = createWorkspaceRemovalActions({
      getRepository: (repositoryId) =>
        repositoryId === repository.id ? repository : null,
      listRepositories: () => [nextRepository],
      inspectRepositoryWorktrees: () => [
        { path: "/repos/alpha" },
        { path: "/repos/alpha/worktrees/feature" },
      ],
      listThreadsByWorktree: listByWorktree,
      deleteThread,
      removeWorkspaceSession,
      runBestEffortRemoveWorktree,
      removeRepository,
      removeRepositoryPreferences,
      getSelectedRepositoryId: () => "repo-1",
      clearSelection,
      notifySessionChanged,
      activateWorkspacePath,
      getRepositoryIdForWorktree: () => null,
      inspectRemainingWorktrees: vi.fn(() => []),
      resolveDefaultThreadContext: vi.fn(),
      switchContextInBackground: vi.fn(),
      getSelectedWorktreeId: () => null,
      removeWorktreeFromGit: vi.fn(),
    });

    await actions.removeRepository("repo-1");

    expect(listByWorktree).toHaveBeenCalledWith(
      "/repos/alpha/worktrees/feature",
    );
    expect(listByWorktree).toHaveBeenCalledWith("/repos/alpha");
    expect(deleteThread.mock.calls).toEqual([
      ["thread-feature-1"],
      ["thread-feature-2"],
      ["thread-root"],
    ]);
    expect(removeWorkspaceSession.mock.calls).toEqual([
      ["/repos/alpha/worktrees/feature"],
      ["/repos/alpha"],
    ]);
    expect(runBestEffortRemoveWorktree).toHaveBeenCalledWith({
      worktreePath: "/repos/alpha/worktrees/feature",
      repositoryRoot: "/repos/alpha",
    });
    expect(removeRepository).toHaveBeenCalledWith("repo-1");
    expect(removeRepositoryPreferences).toHaveBeenCalledWith("repo-1");
    expect(activateWorkspacePath).toHaveBeenCalledWith(
      "/repos/beta/worktrees/feature",
    );
    expect(clearSelection).not.toHaveBeenCalled();
    expect(notifySessionChanged).toHaveBeenCalledTimes(1);
  });

  it("removes an active worktree, deletes its threads, and switches to the next worktree context", async () => {
    const { createWorkspaceRemovalActions } = await import(
      "./workspace-removal-actions"
    );

    const threadContext = {
      repositoryId: "repo-1",
      worktreePath: "/repos/alpha/worktrees/other",
      thread: { id: "thread-next" },
    };
    const deleteThread = vi.fn();
    const removeWorktreeFromGit = vi.fn();
    const resolveDefaultThreadContext = vi
      .fn()
      .mockResolvedValue(threadContext);
    const switchContextInBackground = vi.fn();
    const notifySessionChanged = vi.fn();

    const actions = createWorkspaceRemovalActions({
      getRepository: (repositoryId) =>
        repositoryId === "repo-1"
          ? { id: "repo-1", rootPath: "/repos/alpha" }
          : null,
      listRepositories: () => [{ id: "repo-1", rootPath: "/repos/alpha" }],
      inspectRepositoryWorktrees: vi.fn(() => []),
      listThreadsByWorktree: () => [{ id: "thread-1" }, { id: "thread-2" }],
      deleteThread,
      removeWorkspaceSession: vi.fn(),
      runBestEffortRemoveWorktree: vi.fn(),
      removeRepository: vi.fn(),
      removeRepositoryPreferences: vi.fn(),
      getSelectedRepositoryId: () => null,
      clearSelection: vi.fn(),
      notifySessionChanged,
      activateWorkspacePath: vi.fn(),
      getRepositoryIdForWorktree: (worktreeId) =>
        worktreeId === "/repos/alpha/worktrees/feature" ? "repo-1" : null,
      inspectRemainingWorktrees: () => [
        { path: "/repos/alpha/worktrees/feature" },
        { path: "/repos/alpha/worktrees/other" },
      ],
      resolveDefaultThreadContext,
      switchContextInBackground,
      getSelectedWorktreeId: () => "/repos/alpha/worktrees/feature",
      removeWorktreeFromGit,
    });

    await actions.removeWorktree("/repos/alpha/worktrees/feature/");

    expect(deleteThread.mock.calls).toEqual([["thread-1"], ["thread-2"]]);
    expect(removeWorktreeFromGit).toHaveBeenCalledWith({
      worktreePath: "/repos/alpha/worktrees/feature",
      repositoryRoot: "/repos/alpha",
    });
    expect(resolveDefaultThreadContext).toHaveBeenCalledWith(
      "/repos/alpha/worktrees/other",
      { createIfMissing: true },
    );
    expect(switchContextInBackground).toHaveBeenCalledWith(threadContext);
    expect(notifySessionChanged).not.toHaveBeenCalled();
  });
});
