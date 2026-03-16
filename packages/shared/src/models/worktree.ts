import type { ThreadSnapshot } from "./thread.js";

export type WorktreeGitStatus = "ready" | "missing" | "unavailable";

export interface WorktreeGitSnapshot {
  status: WorktreeGitStatus;
  branch: string | null;
  commit: string | null;
  hasChanges: boolean;
  ahead: number | null;
  behind: number | null;
  stagedCount: number;
  modifiedCount: number;
  untrackedCount: number;
  message: string | null;
}

export interface WorktreeSnapshot {
  id: string;
  label: string;
  path: string;
  isMain: boolean;
  isDetached: boolean;
  git: WorktreeGitSnapshot;
  threads: ThreadSnapshot[];
}
