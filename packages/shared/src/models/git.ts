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

export type GitDiffLineType = "add" | "remove" | "context" | "hunk_header";

export interface GitDiffLine {
  type: GitDiffLineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface GitDiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: GitDiffLine[];
}

export interface GitFileDiff {
  filePath: string;
  oldFilePath: string | null;
  status: GitFileChangeStatus;
  hunks: GitDiffHunk[];
  binary: boolean;
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
