import type { WorktreeSnapshot } from "./worktree.js";

export interface RepositorySnapshot {
  id: string;
  name: string;
  customName?: string | null;
  icon?: string | null;
  accentColor?: string | null;
  rootPath: string;
  defaultBranch: string | null;
  worktrees: WorktreeSnapshot[];
}
