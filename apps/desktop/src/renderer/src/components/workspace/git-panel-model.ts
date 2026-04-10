import type { WorktreeGitSnapshot, WorktreeSnapshot } from "@pidesk/shared";
import { Match } from "effect";

export interface GitPanelRow {
  label: string;
  value: string;
}

export interface GitPanelSection {
  title: string;
  rows: GitPanelRow[];
}

export type GitPanelStatusTone = "muted" | "neutral" | "warning";

export interface GitPanelViewModel {
  title: string;
  branchLabel: string;
  commitLabel: string;
  summary: string;
  syncLabel: string;
  primaryActionLabel: string | null;
  statusTone: GitPanelStatusTone;
  statusMessage: string;
  sections: GitPanelSection[];
}

function formatGitCount(label: string, count: number): string | null {
  if (count <= 0) {
    return null;
  }

  return `${count} ${label}`;
}

function getUnavailableSummary(git: WorktreeGitSnapshot): string {
  return Match.value(git.status).pipe(
    Match.when("missing", () => "Git data missing"),
    Match.orElse(() => "Git unavailable"),
  );
}

function formatGitSyncLabel(git: WorktreeGitSnapshot): string {
  const ahead = git.ahead ?? 0;
  const behind = git.behind ?? 0;

  if (ahead <= 0 && behind <= 0) {
    return "Up to date";
  }

  const parts = [
    formatGitCount("ahead", ahead),
    formatGitCount("behind", behind),
  ].filter((part): part is string => part !== null);

  return parts.join(", ");
}

function resolveBranchLabel(worktree: WorktreeSnapshot): string {
  if (worktree.isDetached) {
    return "Detached HEAD";
  }

  if (worktree.git.branch) {
    return worktree.git.branch;
  }

  return Match.value(worktree.git.status).pipe(
    Match.when("ready", () => "Detached HEAD"),
    Match.orElse(() => "Unavailable"),
  );
}

function resolveStatusState(
  worktree: WorktreeSnapshot | null,
): Pick<
  GitPanelViewModel,
  "primaryActionLabel" | "statusMessage" | "statusTone"
> {
  if (!worktree) {
    return {
      primaryActionLabel: null,
      statusTone: "muted",
      statusMessage:
        "Select a repository worktree to inspect its git state here.",
    };
  }

  return Match.value(worktree.git.status).pipe(
    Match.when("missing", () => ({
      primaryActionLabel: null,
      statusTone: "warning" as const,
      statusMessage:
        worktree.git.message ?? "This worktree is missing git metadata.",
    })),
    Match.when("unavailable", () => ({
      primaryActionLabel: null,
      statusTone: "warning" as const,
      statusMessage:
        worktree.git.message ?? "Git is unavailable for this worktree.",
    })),
    Match.orElse(() => ({
      primaryActionLabel: "Open lazygit",
      statusTone: worktree.git.hasChanges
        ? ("warning" as const)
        : ("neutral" as const),
      statusMessage: worktree.git.hasChanges
        ? "Working tree has local changes."
        : "Working tree is clean.",
    })),
  );
}

export function formatGitCountsSummary(git: WorktreeGitSnapshot): string {
  const parts = [
    formatGitCount("staged", git.stagedCount),
    formatGitCount("modified", git.modifiedCount),
    formatGitCount("untracked", git.untrackedCount),
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) {
    return "Clean";
  }

  return parts.join(", ");
}

export function buildGitPanelViewModel(options: {
  worktree: WorktreeSnapshot | null;
}): GitPanelViewModel {
  const { worktree } = options;

  if (!worktree) {
    return {
      title: "Git",
      branchLabel: "No worktree",
      commitLabel: "No commit",
      summary: "Select a worktree",
      syncLabel: "Git data unavailable",
      ...resolveStatusState(null),
      sections: [],
    };
  }

  const branchLabel = resolveBranchLabel(worktree);
  const commitLabel = worktree.git.commit ?? "No commit";
  const summary =
    worktree.git.status === "ready"
      ? formatGitCountsSummary(worktree.git)
      : getUnavailableSummary(worktree.git);
  const syncLabel =
    worktree.git.status === "ready"
      ? formatGitSyncLabel(worktree.git)
      : "No remote tracking";

  return {
    title: "Git",
    branchLabel,
    commitLabel,
    summary,
    syncLabel,
    ...resolveStatusState(worktree),
    sections: [
      {
        title: "Changes",
        rows: [
          { label: "Summary", value: summary },
          { label: "Branch", value: branchLabel },
          { label: "Commit", value: commitLabel },
          { label: "Sync", value: syncLabel },
        ],
      },
      {
        title: "Workspace",
        rows: [
          { label: "Worktree", value: worktree.label },
          { label: "Path", value: worktree.path },
        ],
      },
    ],
  };
}
