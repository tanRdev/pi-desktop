import type { WorktreeGitSnapshot } from "./worktree.js";

export type GitFileChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type_changed"
  | "unmerged"
  | "untracked"
  | "unknown";

export interface GitFileChange {
  path: string;
  status: GitFileChangeStatus;
  indexStatus: GitFileChangeStatus | null;
  worktreeStatus: GitFileChangeStatus | null;
}

export interface GitRepositoryStatus {
  repositoryPath: string;
  branch: string | null;
  commit: string | null;
  upstreamBranch: string | null;
  summary: WorktreeGitSnapshot;
  stagedChanges: GitFileChange[];
  unstagedChanges: GitFileChange[];
  conflictedChanges: GitFileChange[];
}
