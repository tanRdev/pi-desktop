import type { RepositorySnapshot } from "./repository.js";
import type { ThreadSnapshot } from "./thread.js";
import type { WorkspaceSession } from "./workspace-session.js";
import type { WorktreeSnapshot } from "./worktree.js";

export type AppRuntimeMode = "development" | "production" | "test";

export type ShellAgentMode = "mock" | "sdk" | "unknown";

export interface ShellRuntimeSnapshot {
  agentMode: ShellAgentMode;
  electronVersion?: string;
  agentDirectory?: string | null;
}

export interface ShellProjectSnapshot {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
}

export interface ShellWorkspaceSnapshot {
  rootPath: string;
  agentDirectory: string | null;
  projects: ShellProjectSnapshot[];
}

export interface ShellSelectionSnapshot {
  repositoryId: string | null;
  worktreeId: string | null;
  threadId: string | null;
}

export interface ShellCatalogSnapshot {
  repositories: RepositorySnapshot[];
  selection: ShellSelectionSnapshot;
  reconciledWorkspaceSessions?: WorkspaceSession[];
}

export interface ShellCapabilitiesSnapshot {
  supportsTurns: boolean;
  supportsTools: boolean;
  supportsActivity: boolean;
  supportsParallelSessions: boolean;
}

export interface ShellSnapshot {
  appName: string;
  appVersion: string;
  platform: NodeJS.Platform | string;
  chromeVersion: string;
  mode: AppRuntimeMode;
  runtime?: ShellRuntimeSnapshot;
  catalog: ShellCatalogSnapshot;
  workspace?: ShellWorkspaceSnapshot;
  capabilities?: ShellCapabilitiesSnapshot;
  // Optional git information about the current workspace. Keep lightweight and
  // forward-compatible while the renderer transitions to the repository catalog.
  git?: ShellGitSnapshot;
}

export type ShellGitStatus = "repository" | "not_repo" | "unavailable";

export interface ShellGitSnapshot {
  // Overall state of git for the current workspace
  status: ShellGitStatus;

  // The repository root path when status === 'repository'
  rootPath?: string;

  // Current branch name (or 'HEAD' for detached)
  branch?: string;

  // Short commit SHA (e.g. 7 chars) for HEAD
  commit?: string;

  // Lightweight working-tree summary
  hasChanges?: boolean;
  ahead?: number; // commits ahead of upstream
  behind?: number; // commits behind upstream
  stagedCount?: number;
  modifiedCount?: number;
  untrackedCount?: number;

  // Optional human-friendly message when unavailable or errors occur
  message?: string | null;
}

function getCatalog(
  snapshot: Pick<ShellSnapshot, "catalog">,
): ShellCatalogSnapshot {
  return snapshot.catalog;
}

export function getActiveRepository(
  snapshot: Pick<ShellSnapshot, "catalog">,
): RepositorySnapshot | null {
  const { repositories, selection } = getCatalog(snapshot);

  if (repositories.length === 0) {
    return null;
  }

  return (
    repositories.find(
      (repository) => repository.id === selection.repositoryId,
    ) ??
    repositories[0] ??
    null
  );
}

export function getActiveWorktree(
  snapshot: Pick<ShellSnapshot, "catalog">,
): WorktreeSnapshot | null {
  const repository = getActiveRepository(snapshot);

  if (!repository || repository.worktrees.length === 0) {
    return null;
  }

  return (
    repository.worktrees.find(
      (worktree) => worktree.id === snapshot.catalog.selection.worktreeId,
    ) ??
    repository.worktrees[0] ??
    null
  );
}

export function getActiveThread(
  snapshot: Pick<ShellSnapshot, "catalog">,
): ThreadSnapshot | null {
  const worktree = getActiveWorktree(snapshot);

  if (!worktree || worktree.threads.length === 0) {
    return null;
  }

  const selectedThread = worktree.threads.find(
    (thread) =>
      thread.id === snapshot.catalog.selection.threadId &&
      thread.isArchived === false,
  );

  return (
    selectedThread ??
    worktree.threads.find((thread) => thread.isArchived === false) ??
    worktree.threads[0] ??
    null
  );
}
