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
  commitAndPushActionLabel: string | null;
  pullActionLabel: string | null;
  pushActionLabel: string | null;
  fetchActionLabel: string | null;
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
  | "commitAndPushActionLabel"
  | "pullActionLabel"
  | "pushActionLabel"
  | "fetchActionLabel"
  | "statusMessage"
  | "statusTone"
> {
  if (!worktree) {
    if (shellGit?.status === "not_repo") {
      return {
        commitActionLabel: null,
        commitAndPushActionLabel: null,
        pullActionLabel: null,
        pushActionLabel: null,
        fetchActionLabel: null,
        statusTone: "muted",
        statusMessage: "This folder is open, but it is not a git repository.",
      };
    }

    return {
      commitActionLabel: null,
      commitAndPushActionLabel: null,
      pullActionLabel: null,
      pushActionLabel: null,
      fetchActionLabel: null,
      statusTone: "muted",
      statusMessage:
        "Select a repository worktree to inspect its git state here.",
    };
  }

  return Match.value(worktree.git.status).pipe(
    Match.when("missing", () => ({
      commitActionLabel: null,
      commitAndPushActionLabel: null,
      pullActionLabel: null,
      pushActionLabel: null,
      fetchActionLabel: null,
      statusTone: "warning" as const,
      statusMessage:
        worktree.git.message ?? "This worktree is missing git metadata.",
    })),
    Match.when("unavailable", () => ({
      commitActionLabel: null,
      commitAndPushActionLabel: null,
      pullActionLabel: null,
      pushActionLabel: null,
      fetchActionLabel: null,
      statusTone: "warning" as const,
      statusMessage:
        worktree.git.message ?? "Git is unavailable for this worktree.",
    })),
    Match.orElse(() => {
      const hasUncommittedChanges =
        worktree.git.stagedCount > 0 ||
        worktree.git.modifiedCount > 0 ||
        worktree.git.untrackedCount > 0;
      const canCommit = worktree.git.stagedCount > 0;

      return {
        commitActionLabel: canCommit ? "Commit" : null,
        commitAndPushActionLabel: canCommit ? "Commit & Push" : null,
        pullActionLabel: "Pull",
        pushActionLabel: "Push",
        fetchActionLabel: "Fetch",
        statusTone: hasUncommittedChanges
          ? ("warning" as const)
          : ("neutral" as const),
        statusMessage: hasUncommittedChanges
          ? "Working tree has local changes."
          : "Working tree is clean.",
      };
    }),
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

// ============================================================================
// Extensions (A8): templates, amend, branch list, stash list, focus state
// Frontend-only state for features whose backend IPC may not yet be wired.
// ============================================================================

export interface CommitTemplate {
  readonly id: string;
  readonly label: string;
  readonly message: string;
}

/**
 * Conventional-commit inspired default templates. Pure data so they can be
 * overridden per-project later without touching the view model.
 */
export const DEFAULT_COMMIT_TEMPLATES: ReadonlyArray<CommitTemplate> = [
  { id: "feat", label: "feat", message: "feat: " },
  { id: "fix", label: "fix", message: "fix: " },
  { id: "chore", label: "chore", message: "chore: " },
  { id: "docs", label: "docs", message: "docs: " },
  { id: "refactor", label: "refactor", message: "refactor: " },
  { id: "test", label: "test", message: "test: " },
  { id: "perf", label: "perf", message: "perf: " },
];

export function applyCommitTemplate(
  current: string,
  template: CommitTemplate,
): string {
  const trimmed = current.trimStart();
  if (trimmed.length === 0) {
    return template.message;
  }
  // If the current message already starts with a known type prefix, replace it.
  const prefixMatch = trimmed.match(/^([a-z]+)(\([^)]*\))?:\s*/);
  if (prefixMatch) {
    return template.message + trimmed.slice(prefixMatch[0].length);
  }
  return template.message + trimmed;
}

/**
 * Per-file granular tracking. A file may have staged hunks, unstaged hunks,
 * both, or be in conflict. Captures that explicitly for richer UI.
 */
export type FileStageState =
  | "staged"
  | "unstaged"
  | "partial" // both staged and unstaged changes
  | "conflicted"
  | "untracked";

export interface FileStageEntry {
  readonly path: string;
  readonly state: FileStageState;
  readonly status: string;
}

export function buildFileStageEntries(
  status: GitRepositoryStatus | null,
): ReadonlyArray<FileStageEntry> {
  if (!status) return [];
  const stagedByPath = new Map(status.stagedChanges.map((c) => [c.path, c]));
  const unstagedByPath = new Map(
    status.unstagedChanges.map((c) => [c.path, c]),
  );
  const conflictedPaths = new Set(status.conflictedChanges.map((c) => c.path));
  const paths = new Set<string>();
  stagedByPath.forEach((_v, k) => {
    paths.add(k);
  });
  unstagedByPath.forEach((_v, k) => {
    paths.add(k);
  });
  conflictedPaths.forEach((p) => {
    paths.add(p);
  });

  return Array.from(paths)
    .sort()
    .map((path): FileStageEntry => {
      const staged = stagedByPath.get(path);
      const unstaged = unstagedByPath.get(path);
      const conflicted = status.conflictedChanges.find((c) => c.path === path);
      const rawStatus =
        staged?.status ?? unstaged?.status ?? conflicted?.status ?? "unknown";
      if (conflictedPaths.has(path)) {
        return { path, state: "conflicted", status: rawStatus };
      }
      if (staged && unstaged) {
        return { path, state: "partial", status: rawStatus };
      }
      if (staged) {
        return { path, state: "staged", status: rawStatus };
      }
      if (unstaged?.status === "untracked") {
        return { path, state: "untracked", status: rawStatus };
      }
      return { path, state: "unstaged", status: rawStatus };
    });
}

/**
 * Keyboard focus tracking among the changed-file list. The view keeps the
 * focused index in sync with the sorted union of staged+unstaged paths.
 */
export interface FocusState {
  readonly index: number;
  readonly path: string | null;
}

export function nextFocusIndex(
  current: number,
  total: number,
  direction: 1 | -1,
): number {
  if (total <= 0) return 0;
  const next = current + direction;
  if (next < 0) return 0;
  if (next >= total) return total - 1;
  return next;
}

export function resolveFocusedPath(
  entries: ReadonlyArray<FileStageEntry>,
  index: number,
): string | null {
  if (entries.length === 0) return null;
  const clamped = Math.max(0, Math.min(index, entries.length - 1));
  return entries[clamped]?.path ?? null;
}

/**
 * Branch list shape. Backend IPC is not yet wired — callers must treat this
 * as frontend-only state. TODO(a8): replace with window.piDesktop.git.listBranches
 * once A6 adds the channel.
 */
export interface BranchSummary {
  readonly name: string;
  readonly isCurrent: boolean;
  readonly isRemote: boolean;
  readonly upstream: string | null;
}

/**
 * Stash list shape. TODO(a8): backend IPC not yet available. Keep as
 * UI-only state; the stash panel should be gated behind a capability probe.
 */
export interface StashEntry {
  readonly id: string;
  readonly message: string;
  readonly createdAt: number;
  readonly branch: string | null;
}

/**
 * Capability flags for optional backend features. Components should probe
 * `window.piDesktop.git` with optional chaining and pass booleans here.
 */
export interface GitPanelCapabilities {
  readonly revertFile: boolean;
  readonly amend: boolean;
  readonly listBranches: boolean;
  readonly switchBranch: boolean;
  readonly listStashes: boolean;
}

export const NO_GIT_CAPABILITIES: GitPanelCapabilities = {
  revertFile: false,
  amend: false,
  listBranches: false,
  switchBranch: false,
  listStashes: false,
};

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
