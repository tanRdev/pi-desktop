import type {
  GitRepositoryStatus,
  WorktreeGitSnapshot,
} from "@pi-desktop/shared";
import { parseGitFileChange } from "./status-parsers";

export interface RepositoryStatusInput {
  repositoryPath: string;
  branch: string | null;
  commit: string | null;
  upstreamBranch: string | null;
  summary: WorktreeGitSnapshot;
  porcelainOutput: string;
}

export function buildRepositoryStatusFromPorcelain(
  input: RepositoryStatusInput,
): GitRepositoryStatus {
  const allChanges = input.porcelainOutput.split(/\r?\n/).flatMap((line) => {
    const parsed = parseGitFileChange(line);
    return parsed ? [parsed] : [];
  });

  return {
    repositoryPath: input.repositoryPath,
    branch: input.branch,
    commit: input.commit,
    upstreamBranch: input.upstreamBranch,
    summary: input.summary,
    stagedChanges: allChanges.filter((change) => change.indexStatus !== null),
    unstagedChanges: allChanges.filter(
      (change) =>
        change.worktreeStatus !== null && change.worktreeStatus !== "unmerged",
    ),
    conflictedChanges: allChanges.filter(
      (change) =>
        change.status === "unmerged" ||
        change.indexStatus === "unmerged" ||
        change.worktreeStatus === "unmerged",
    ),
  };
}
