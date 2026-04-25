import type {
  GitRepositoryInspection,
  GitWorktreeSummary,
} from "../git-worktree-service";

export function buildRepositoryInspection(options: {
  currentWorktreeRoot: string;
  defaultBranch: string | null;
  worktrees: GitWorktreeSummary[];
}): GitRepositoryInspection {
  const mainWorktree = options.worktrees.find((worktree) => worktree.isMain);
  const currentWorktree =
    options.worktrees.find(
      (worktree) => worktree.path === options.currentWorktreeRoot,
    ) ??
    options.worktrees[0] ??
    null;
  const rootPath = mainWorktree?.path ?? options.currentWorktreeRoot;

  return {
    status: "repository",
    rootPath,
    currentWorktreePath: currentWorktree?.path ?? options.currentWorktreeRoot,
    defaultBranch: options.defaultBranch,
    worktrees: options.worktrees,
    currentGit: currentWorktree
      ? {
          status: "repository",
          rootPath,
          branch: currentWorktree.isDetached
            ? "HEAD"
            : (currentWorktree.branch ?? undefined),
          commit: currentWorktree.commit ?? undefined,
          hasChanges: currentWorktree.git.hasChanges,
          ahead: currentWorktree.git.ahead ?? 0,
          behind: currentWorktree.git.behind ?? 0,
          stagedCount: currentWorktree.git.stagedCount,
          modifiedCount: currentWorktree.git.modifiedCount,
          untrackedCount: currentWorktree.git.untrackedCount,
          message: currentWorktree.git.message,
        }
      : undefined,
    message: null,
  };
}
