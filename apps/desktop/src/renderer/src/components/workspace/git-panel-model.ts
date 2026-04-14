import type {
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeGitSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
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
  upstreamLabel: string;
  commitActionLabel: string | null;
  pullActionLabel: string | null;
  pushActionLabel: string | null;
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
  shellGit: ShellGitSnapshot | null,
): Pick<
  GitPanelViewModel,
  | "commitActionLabel"
  | "pullActionLabel"
  | "pushActionLabel"
  | "statusMessage"
  | "statusTone"
> {
  if (!worktree) {
    if (shellGit?.status === "not_repo") {
      return {
        commitActionLabel: null,
        pullActionLabel: null,
        pushActionLabel: null,
        statusTone: "muted",
        statusMessage: "This folder is open, but it is not a git repository.",
      };
    }

    return {
      commitActionLabel: null,
      pullActionLabel: null,
      pushActionLabel: null,
      statusTone: "muted",
      statusMessage:
        "Select a repository worktree to inspect its git state here.",
    };
  }

  return Match.value(worktree.git.status).pipe(
    Match.when("missing", () => ({
      commitActionLabel: null,
      pullActionLabel: null,
      pushActionLabel: null,
      statusTone: "warning" as const,
      statusMessage:
        worktree.git.message ?? "This worktree is missing git metadata.",
    })),
    Match.when("unavailable", () => ({
      commitActionLabel: null,
      pullActionLabel: null,
      pushActionLabel: null,
      statusTone: "warning" as const,
      statusMessage:
        worktree.git.message ?? "Git is unavailable for this worktree.",
    })),
    Match.orElse(() => ({
      commitActionLabel: "Commit changes",
      pullActionLabel: "Pull",
      pushActionLabel: "Push",
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
  repositoryStatus: GitRepositoryStatus | null;
  repositoryPath: string | null;
  shellGit: ShellGitSnapshot | null;
}): GitPanelViewModel {
  const { worktree, repositoryStatus, repositoryPath, shellGit } = options;

  if (!worktree) {
    if (repositoryPath && shellGit?.status === "not_repo") {
      return {
        title: "Git",
        branchLabel: "Not a git repository",
        commitLabel: "No commit",
        summary: "Open folder only",
        syncLabel: "Git unavailable",
        upstreamLabel: "No upstream",
        ...resolveStatusState(null, shellGit),
        sections: [
          {
            title: "Workspace",
            rows: [{ label: "Path", value: repositoryPath }],
          },
        ],
      };
    }

    return {
      title: "Git",
      branchLabel: "No worktree",
      commitLabel: "No commit",
      summary: "Select a worktree",
      syncLabel: "Git data unavailable",
      upstreamLabel: "No upstream",
      ...resolveStatusState(null, shellGit),
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
  const upstreamLabel = repositoryStatus?.upstreamBranch ?? "No upstream";

  return {
    title: "Git",
    branchLabel,
    commitLabel,
    summary,
    syncLabel,
    upstreamLabel,
    ...resolveStatusState(worktree, shellGit),
    sections: [
      {
        title: "Changes",
        rows: [
          { label: "Summary", value: summary },
          { label: "Branch", value: branchLabel },
          { label: "Commit", value: commitLabel },
          { label: "Sync", value: syncLabel },
          { label: "Upstream", value: upstreamLabel },
        ],
      },
      ...(repositoryStatus
        ? [
            {
              title: "Native Git",
              rows: [
                {
                  label: "Staged files",
                  value: String(repositoryStatus.stagedChanges.length),
                },
                {
                  label: "Unstaged files",
                  value: String(repositoryStatus.unstagedChanges.length),
                },
                {
                  label: "Conflicts",
                  value: String(repositoryStatus.conflictedChanges.length),
                },
              ],
            },
          ]
        : []),
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
