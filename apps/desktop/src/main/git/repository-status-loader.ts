import type {
  GitRepositoryStatus,
  WorktreeGitSnapshot,
} from "@pi-desktop/shared";
import type { GitRepositoryInspection } from "../git-worktree-service";
import type { RunGit } from "./git-command-runner";
import { resolveUpstreamBranch } from "./repository-meta";
import { buildRepositoryStatusFromPorcelain } from "./repository-status";

type RepositoryInspection = {
  currentWorktreePath: string;
  worktrees: NonNullable<GitRepositoryInspection["worktrees"]>;
};

type LoadRepositoryStatusInput = {
  repositoryPath: string;
  inspectRepository(): GitRepositoryInspection;
  runGit: RunGit;
  resolveUpstreamBranch?: typeof resolveUpstreamBranch;
  buildRepositoryStatus?: typeof buildRepositoryStatusFromPorcelain;
};

type CurrentWorktree = {
  path: string;
  branch: string | null;
  commit: string | null;
  git: WorktreeGitSnapshot;
};

function resolveRepositoryInspection(
  inspection: GitRepositoryInspection,
): RepositoryInspection {
  if (
    inspection.status !== "repository" ||
    !inspection.currentWorktreePath ||
    !inspection.worktrees
  ) {
    throw new Error(inspection.message ?? "Git repository is unavailable");
  }

  const worktrees = inspection.worktrees;

  return {
    currentWorktreePath: inspection.currentWorktreePath,
    worktrees,
  };
}

function resolveCurrentWorktree(
  inspection: RepositoryInspection,
): CurrentWorktree {
  const currentWorktree = inspection.worktrees.find(
    (worktree) => worktree.path === inspection.currentWorktreePath,
  );

  if (!currentWorktree) {
    throw new Error("Active worktree status is unavailable");
  }

  return currentWorktree;
}

function loadPorcelainOutput(runGit: RunGit, worktreePath: string): string {
  const porcelainResult = runGit(worktreePath, ["status", "--porcelain"]);
  if (porcelainResult.error || porcelainResult.status !== 0) {
    throw new Error(
      porcelainResult.error?.message ||
        porcelainResult.stderr.trim() ||
        "Failed to inspect repository status",
    );
  }

  return porcelainResult.stdout;
}

export function loadRepositoryStatus(
  input: LoadRepositoryStatusInput,
): GitRepositoryStatus {
  const inspection = resolveRepositoryInspection(input.inspectRepository());
  const currentWorktree = resolveCurrentWorktree(inspection);
  const porcelainOutput = loadPorcelainOutput(
    input.runGit,
    inspection.currentWorktreePath,
  );
  const resolveUpstream = input.resolveUpstreamBranch ?? resolveUpstreamBranch;
  const buildRepositoryStatus =
    input.buildRepositoryStatus ?? buildRepositoryStatusFromPorcelain;

  return buildRepositoryStatus({
    repositoryPath: inspection.currentWorktreePath,
    branch: currentWorktree.branch,
    commit: currentWorktree.commit,
    upstreamBranch: resolveUpstream(
      input.runGit,
      inspection.currentWorktreePath,
    ),
    summary: currentWorktree.git,
    porcelainOutput,
  });
}
