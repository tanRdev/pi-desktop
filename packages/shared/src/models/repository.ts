import type { WorktreeSnapshot } from "./worktree.js";

export interface RepositorySnapshot {
  id: string;
  name: string;
  rootPath: string;
  defaultBranch: string | null;
  worktrees: WorktreeSnapshot[];
}
