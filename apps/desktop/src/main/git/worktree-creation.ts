import type { RunGit } from "./git-command-runner";

export function buildCreateWorktreeCommand(
  runGit: RunGit,
  options: {
    repositoryRoot: string;
    branchName: string;
    worktreePath: string;
    baseBranch?: string;
  },
): string[] {
  const branchExists = runGit(options.repositoryRoot, [
    "show-ref",
    "--verify",
    `refs/heads/${options.branchName}`,
  ]);

  if (branchExists.status === 0) {
    return ["worktree", "add", options.worktreePath, options.branchName];
  }

  const startRef = resolveCreateWorktreeStartRef(runGit, options);

  if (startRef) {
    return [
      "worktree",
      "add",
      "-b",
      options.branchName,
      options.worktreePath,
      startRef,
    ];
  }

  return ["worktree", "add", "-b", options.branchName, options.worktreePath];
}

function resolveCreateWorktreeStartRef(
  runGit: RunGit,
  options: {
    repositoryRoot: string;
    baseBranch?: string;
  },
): string | undefined {
  if (!options.baseBranch) {
    return undefined;
  }

  const localRef = runGit(options.repositoryRoot, [
    "show-ref",
    "--verify",
    `refs/heads/${options.baseBranch}`,
  ]);
  if (localRef.status === 0) {
    return options.baseBranch;
  }

  const remoteRef = runGit(options.repositoryRoot, [
    "show-ref",
    "--verify",
    `refs/remotes/origin/${options.baseBranch}`,
  ]);
  if (remoteRef.status === 0) {
    return `origin/${options.baseBranch}`;
  }

  return undefined;
}
