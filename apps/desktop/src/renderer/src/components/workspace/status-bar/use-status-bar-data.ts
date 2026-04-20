import type { GitRepositoryStatus, ShellGitSnapshot } from "@pi-desktop/shared";

export interface StatusBarSignals {
  branchName: string | null;
  stagedCount: number;
  unstagedCount: number;
  activeModel: string;
  notificationsCount: number;
}

export interface UseStatusBarDataInput {
  gitStatus?: GitRepositoryStatus | null;
  shellGit?: ShellGitSnapshot | null;
  currentModelValue?: string | null;
  notificationsCount?: number | null;
}

/**
 * Aggregates the signals rendered by the bottom status bar into a single
 * stable shape. Missing data is normalized so consumers never crash on
 * absent fields. This is intentionally a pure function (not a React hook)
 * so it is trivial to unit-test and inexpensive to recompute on every
 * render of the parent shell.
 */
export function useStatusBarData({
  gitStatus,
  shellGit,
  currentModelValue,
  notificationsCount,
}: UseStatusBarDataInput): StatusBarSignals {
  const branchName =
    gitStatus?.branch ?? (shellGit?.branch ? shellGit.branch : null);

  const stagedCount =
    gitStatus?.stagedChanges.length ?? shellGit?.stagedCount ?? 0;
  const unstagedCount =
    gitStatus?.unstagedChanges.length ?? shellGit?.modifiedCount ?? 0;

  const trimmedModel = currentModelValue?.trim();
  const activeModel = trimmedModel ? trimmedModel : "auto";

  return {
    branchName,
    stagedCount,
    unstagedCount,
    activeModel,
    notificationsCount: Math.max(0, notificationsCount ?? 0),
  };
}
