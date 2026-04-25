import path from "node:path";

import {
  createEmptyWorkspaceSession,
  isFileBackedWindow,
  type ShellCatalogSnapshot,
  type WorkspaceSession,
  type WorkspaceWindow,
} from "@pi-desktop/shared";

type ThreadLookup = Map<string, Set<string>>;

function isWithinWorktree(worktreeId: string, targetPath: string): boolean {
  const normalizedTargetPath = path.resolve(targetPath);
  return (
    normalizedTargetPath === worktreeId ||
    normalizedTargetPath.startsWith(`${worktreeId}${path.sep}`)
  );
}

function indexThreadsByWorktree(
  repositories: ShellCatalogSnapshot["repositories"],
): ThreadLookup {
  const index: ThreadLookup = new Map();

  for (const repository of repositories) {
    for (const worktree of repository.worktrees) {
      index.set(
        worktree.id,
        new Set(worktree.threads.map((thread) => thread.id)),
      );
    }
  }

  return index;
}

export function reconcileWorkspaceSessions(input: {
  repositories: ShellCatalogSnapshot["repositories"];
  workspaceSessions: WorkspaceSession[];
}): WorkspaceSession[] {
  const { repositories, workspaceSessions } = input;
  const worktreeIds = new Set(
    repositories.flatMap((repository) =>
      repository.worktrees.map((worktree) => worktree.id),
    ),
  );
  const threadIdsByWorktree = indexThreadsByWorktree(repositories);

  return workspaceSessions.flatMap((session) => {
    if (!worktreeIds.has(session.worktreeId)) {
      return [];
    }

    const validThreadIds =
      threadIdsByWorktree.get(session.worktreeId) ?? new Set();
    const candidateWindows = session.layout.windows.filter((window) => {
      if (window.kind === "chat") {
        return validThreadIds.has(window.threadId);
      }

      if (isFileBackedWindow(window)) {
        return isWithinWorktree(session.worktreeId, window.filePath);
      }

      return true;
    });
    const validWindows = candidateWindows.map((window): WorkspaceWindow => {
      if (window.kind === "terminal") {
        return {
          ...window,
          backend: window.backend === "pi" ? "pi" : "shell",
          cwd: isWithinWorktree(session.worktreeId, window.cwd)
            ? window.cwd
            : session.worktreeId,
        };
      }

      if (window.kind === "git") {
        return {
          ...window,
          repositoryPath: isWithinWorktree(
            session.worktreeId,
            window.repositoryPath,
          )
            ? window.repositoryPath
            : session.worktreeId,
        };
      }

      return window;
    });
    const validWindowIds = new Set(validWindows.map((window) => window.id));
    const focusedWindowId =
      session.layout.focusedWindowId &&
      validWindowIds.has(session.layout.focusedWindowId)
        ? session.layout.focusedWindowId
        : (validWindows.findLast((window) => window.kind === "chat")?.id ??
          validWindows[0]?.id ??
          null);
    const promptDrafts = Object.fromEntries(
      Object.entries(session.promptDrafts).filter(([threadId]) =>
        validThreadIds.has(threadId),
      ),
    );
    const recoveryDrafts = Object.fromEntries(
      Object.entries(session.recoveryDrafts).filter(([draftId, draft]) =>
        draft.kind === "note" ? true : validThreadIds.has(draftId),
      ),
    );
    const files = Object.fromEntries(
      Object.entries(session.files).filter(([filePath]) =>
        isWithinWorktree(session.worktreeId, filePath),
      ),
    );
    const selectedPath =
      session.search.selectedPath &&
      isWithinWorktree(session.worktreeId, session.search.selectedPath)
        ? session.search.selectedPath
        : null;

    return [
      {
        ...createEmptyWorkspaceSession(session.worktreeId),
        ...session,
        promptDrafts,
        recoveryDrafts,
        files,
        search: {
          ...session.search,
          selectedPath,
        },
        layout: {
          ...session.layout,
          windows: validWindows,
          focusedWindowId,
          nextZIndex: Math.max(
            session.layout.nextZIndex,
            session.layout.windows.reduce(
              (maxZIndex, window) => Math.max(maxZIndex, window.zIndex),
              0,
            ) + 1,
          ),
        },
      },
    ];
  });
}
