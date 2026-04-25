import type {
  GitRepositoryStatus,
  RepositorySnapshot,
  ShellGitSnapshot,
} from "@pi-desktop/shared";
import {
  type ContextSurfaceKey,
  type ContextWindow,
  getMainPaneState,
} from "../workspace-pane-state";

interface BuildWorkspaceShellDerivedStateParams {
  activeRepository: RepositorySnapshot | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  activeGitRepositoryStatus: GitRepositoryStatus | null;
  shellGit: ShellGitSnapshot | null;
  contextWindows: ContextWindow[];
  selectedContextSurface: ContextSurfaceKey | null;
}

export interface WorkspaceShellDerivedState {
  projectName: string;
  activeWorktree: RepositorySnapshot["worktrees"][number] | null;
  hasActiveThread: boolean;
  hasChangesToCommit: boolean;
  hasCommitsToPush: boolean;
  selectedFileWindow: Extract<ContextWindow, { kind: "file" }> | null;
}

export function buildWorkspaceShellDerivedState({
  activeRepository,
  activeWorktreeId,
  activeThreadId,
  activeGitRepositoryStatus,
  shellGit,
  contextWindows,
  selectedContextSurface,
}: BuildWorkspaceShellDerivedStateParams): WorkspaceShellDerivedState {
  const projectName =
    activeRepository?.customName ?? activeRepository?.name ?? "Pi";
  const activeWorktree =
    activeRepository?.worktrees.find(
      (worktree) => worktree.id === activeWorktreeId,
    ) ?? null;
  const hasActiveThread = activeThreadId !== null;
  const hasChangesToCommit =
    (activeGitRepositoryStatus?.stagedChanges.length ?? 0) +
      (activeGitRepositoryStatus?.unstagedChanges.length ?? 0) >
    0;
  const hasCommitsToPush = (shellGit?.ahead ?? 0) > 0;
  const mainPaneState = getMainPaneState({
    contextWindows,
    selectedContextSurface,
  });
  const selectedFileWindow =
    mainPaneState.selectedFileWindowId === null
      ? null
      : (contextWindows.find(
          (window): window is Extract<ContextWindow, { kind: "file" }> =>
            window.kind === "file" &&
            window.id === mainPaneState.selectedFileWindowId,
        ) ?? null);

  return {
    projectName,
    activeWorktree,
    hasActiveThread,
    hasChangesToCommit,
    hasCommitsToPush,
    selectedFileWindow,
  };
}
