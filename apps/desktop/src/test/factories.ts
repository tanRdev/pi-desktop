import type {
  RepositorySnapshot,
  ThreadSnapshot,
  WorktreeGitSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";

export function createGitSnapshot(
  overrides: Partial<WorktreeGitSnapshot> = {},
): WorktreeGitSnapshot {
  return {
    status: "ready",
    branch: "main",
    commit: "abc123",
    hasChanges: false,
    ahead: 0,
    behind: 0,
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    message: null,
    ...overrides,
  };
}

export function createThread(
  overrides: Partial<ThreadSnapshot> = {},
): ThreadSnapshot {
  const { runtime: runtimeOverrides, ...rest } = overrides;
  return {
    id: "thread-1",
    title: "Thread",
    lastActivityAt: 1,
    runtime: {
      status: "ready",
      lastError: null,
      ...runtimeOverrides,
    },
    ...rest,
  };
}

export interface CreateWorktreeOverrides
  extends Partial<Omit<WorktreeSnapshot, "git">> {
  git?: Partial<WorktreeGitSnapshot>;
}

export function createWorktree(
  overrides: CreateWorktreeOverrides = {},
): WorktreeSnapshot {
  const { git: gitOverrides, threads: threadOverrides, ...rest } = overrides;
  return {
    id: "worktree-1",
    label: "main",
    path: "/tmp/workspace",
    isMain: true,
    isDetached: false,
    git: createGitSnapshot(gitOverrides),
    threads: threadOverrides ?? [createThread()],
    ...rest,
  };
}

export interface CreateRepositoryOverrides
  extends Partial<Omit<RepositorySnapshot, "worktrees">> {
  worktrees?: WorktreeSnapshot[];
}

export function createRepository(
  overrides: CreateRepositoryOverrides = {},
): RepositorySnapshot {
  const { worktrees: worktreeOverrides, ...rest } = overrides;
  return {
    id: "repo-1",
    name: "Alpha Workspace",
    customName: null,
    icon: null,
    accentColor: null,
    rootPath: "/tmp/alpha-workspace",
    defaultBranch: "main",
    worktrees: worktreeOverrides ?? [createWorktree()],
    ...rest,
  };
}
