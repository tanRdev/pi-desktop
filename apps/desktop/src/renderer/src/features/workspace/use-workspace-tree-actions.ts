import type { RepositorySnapshot, WorktreeSnapshot } from "@pi-desktop/shared";
import * as React from "react";
import { toast } from "@/lib/toast";

export interface ConfirmRemoveRepositoryInput {
  repositoryId: string;
  repositoryName: string;
}

export interface WorkspaceTreeActionsController {
  addRepository: () => Promise<void>;
  selectRepository: (repositoryId: string) => Promise<void>;
  removeRepository: (repositoryId: string) => Promise<void>;
  copyRepositoryPath: (repositoryId: string) => Promise<void>;
  openInFinder: (repositoryId: string) => Promise<void>;
  createSession: () => Promise<void>;
  selectWorktree: (worktreeId: string) => Promise<void>;
  createThread: (worktreeId: string) => Promise<string>;
  closeThread: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  deleteWorktree: (worktreeId: string) => Promise<void>;
  selectThread: (threadId: string) => Promise<void>;
}

export interface UseWorkspaceTreeActionsOptions {
  repositories: RepositorySnapshot[];
  activeRepository: RepositorySnapshot | null;
  activeWorktree: WorktreeSnapshot | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  reload: () => Promise<void>;
  clearSelectedContextSurface: () => void;
  confirmRemoveRepository: (input: ConfirmRemoveRepositoryInput) => void;
  requestInitGitRepo: (path: string, name: string) => void;
  setCreateWorktreeOpen: (open: boolean) => void;
}

export function useWorkspaceTreeActions({
  repositories,
  activeRepository,
  activeWorktree,
  activeWorktreeId,
  activeThreadId,
  reload,
  clearSelectedContextSurface,
  confirmRemoveRepository,
  requestInitGitRepo,
  setCreateWorktreeOpen,
}: UseWorkspaceTreeActionsOptions): WorkspaceTreeActionsController {
  const addRepository = React.useCallback(async () => {
    const paths = await window.piDesktop.dialog.showOpenDialog({
      properties: ["openDirectory", "multiSelections"],
      title: "Add Repository",
    });
    if (!paths || paths.length === 0) {
      return;
    }

    let addedCount = 0;

    for (const repositoryPath of paths) {
      const repositoryName =
        repositoryPath
          .split(/[\\/]+/)
          .filter(Boolean)
          .pop() ?? repositoryPath;

      const isRepo = await window.piDesktop.git.isRepository(repositoryPath);

      if (!isRepo) {
        requestInitGitRepo(repositoryPath, repositoryName);
        break;
      }

      try {
        await window.piDesktop.repositories.add(repositoryPath);
        addedCount += 1;
      } catch (error) {
        toast.error("Invalid repository", {
          description:
            error instanceof Error
              ? error.message
              : "The selected directory is not a valid git repository",
        });
      }
    }

    if (addedCount > 0) {
      await reload();
    }

    if (addedCount === 1) {
      toast.success("Workspace added");
    } else if (addedCount > 1) {
      toast.success("Workspaces added", {
        description: `${addedCount} projects are now available in the rail`,
      });
    }
  }, [reload, requestInitGitRepo]);

  const selectRepository = React.useCallback(
    async (repositoryId: string) => {
      const repository = repositories.find(
        (entry) => entry.id === repositoryId,
      );
      if (!repository) {
        return;
      }

      clearSelectedContextSurface();
      await window.piDesktop.repositories.select(repositoryId);
    },
    [clearSelectedContextSurface, repositories],
  );

  const removeRepository = React.useCallback(
    async (repositoryId: string) => {
      const repository = repositories.find(
        (entry) => entry.id === repositoryId,
      );
      if (!repository) {
        return;
      }

      confirmRemoveRepository({
        repositoryId,
        repositoryName: repository.customName ?? repository.name,
      });
    },
    [confirmRemoveRepository, repositories],
  );

  const copyRepositoryPath = React.useCallback(
    async (repositoryId: string) => {
      const repository = repositories.find(
        (entry) => entry.id === repositoryId,
      );
      if (!repository) {
        toast.error("Repository not found");
        return;
      }

      try {
        await window.piDesktop.clipboard.writeText(repository.rootPath);
        toast.success("Path copied");
      } catch {
        toast.error("Failed to copy path");
      }
    },
    [repositories],
  );

  const openInFinder = React.useCallback(async (repositoryId: string) => {
    await window.piDesktop.repositories.openInFinder(repositoryId);
    toast.success("Opened in Finder");
  }, []);

  const selectWorktree = React.useCallback(async (worktreeId: string) => {
    await window.piDesktop.worktrees.select(worktreeId);
  }, []);

  const createSession = React.useCallback(async () => {
    if (!activeRepository) {
      toast.error("No project selected", {
        description: "Add or select a project to create a session.",
      });
      return;
    }

    const rootPath = activeRepository.rootPath;
    const repositoryName =
      activeRepository.customName ?? activeRepository.name ?? rootPath;

    try {
      const isRepo = await window.piDesktop.git.isRepository(rootPath);
      if (!isRepo) {
        requestInitGitRepo(rootPath, repositoryName);
        return;
      }
    } catch {
      // If the check fails, fall through and let the dialog handle errors.
    }

    setCreateWorktreeOpen(true);
  }, [activeRepository, requestInitGitRepo, setCreateWorktreeOpen]);

  const createThread = React.useCallback(
    async (worktreeId: string) => {
      const threadId = await window.piDesktop.threads.create(worktreeId);
      clearSelectedContextSurface();
      return threadId;
    },
    [clearSelectedContextSurface],
  );

  const closeThread = React.useCallback(
    async (threadId: string) => {
      if (activeThreadId === threadId) {
        const otherThreads = activeWorktree?.threads.filter(
          (thread) => thread.id !== threadId,
        );
        if (otherThreads && otherThreads.length > 0 && otherThreads[0]) {
          await window.piDesktop.threads.select(otherThreads[0].id);
        } else {
          clearSelectedContextSurface();
        }
      }

      await window.piDesktop.threads.delete(threadId);
    },
    [activeThreadId, activeWorktree, clearSelectedContextSurface],
  );

  const deleteThread = React.useCallback(
    async (threadId: string) => {
      await window.piDesktop.threads.delete(threadId);
      if (activeThreadId === threadId) {
        clearSelectedContextSurface();
      }
    },
    [activeThreadId, clearSelectedContextSurface],
  );

  const deleteWorktree = React.useCallback(
    async (worktreeId: string) => {
      try {
        await window.piDesktop.worktrees.remove(worktreeId);
        if (activeWorktreeId === worktreeId) {
          clearSelectedContextSurface();
        }
      } catch (error) {
        console.error("Failed to remove worktree:", error);
      }
    },
    [activeWorktreeId, clearSelectedContextSurface],
  );

  const selectThread = React.useCallback(
    async (threadId: string) => {
      clearSelectedContextSurface();
      await window.piDesktop.threads.select(threadId);
    },
    [clearSelectedContextSurface],
  );

  return {
    addRepository,
    selectRepository,
    removeRepository,
    copyRepositoryPath,
    openInFinder,
    createSession,
    selectWorktree,
    createThread,
    closeThread,
    deleteThread,
    deleteWorktree,
    selectThread,
  };
}
