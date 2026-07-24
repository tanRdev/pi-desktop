import type { ShellGitSnapshot, WorktreeGitSnapshot } from "@pi-desktop/shared";

export interface GitWorktreeSummary {
  id: string;
  path: string;
  isMain: boolean;
  isCurrent: boolean;
  isDetached: boolean;
  isPrunable: boolean;
  prunableReason: string | null;
  branch: string | null;
  commit: string | null;
  git: WorktreeGitSnapshot;
}

export interface GitRepositoryInspection {
  status: "repository" | "not_repo" | "unavailable";
  rootPath?: string;
  currentWorktreePath?: string;
  defaultBranch?: string | null;
  worktrees?: GitWorktreeSummary[];
  currentGit?: ShellGitSnapshot;
  message: string | null;
}
