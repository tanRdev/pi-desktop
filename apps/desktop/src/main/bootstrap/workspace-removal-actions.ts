import path from "node:path";
import type { SelectedThreadContext } from "./thread-context";

type RepositoryEntry = {
  id: string;
  rootPath: string;
  lastSelectedWorktreeId?: string | null;
};

type WorktreeEntry = {
  path: string;
};

type ThreadEntry = {
  id: string;
};

type CreateWorkspaceRemovalActionsDependencies = {
  getRepository: (repositoryId: string) => RepositoryEntry | null;
  listRepositories: () => RepositoryEntry[];
  inspectRepositoryWorktrees: (repositoryRoot: string) => WorktreeEntry[];
  listThreadsByWorktree: (worktreeId: string) => ThreadEntry[];
  deleteThread: (threadId: string) => void;
  removeWorkspaceSession: (worktreeId: string) => void;
  runBestEffortRemoveWorktree: (input: {
    worktreePath: string;
    repositoryRoot: string;
  }) => void;
  removeRepository: (repositoryId: string) => void;
  removeRepositoryPreferences: (repositoryId: string) => void;
  getSelectedRepositoryId: () => string | null;
  clearSelection: () => void;
  notifySessionChanged: () => void;
  activateWorkspacePath: (targetPath: string) => Promise<void>;
  getRepositoryIdForWorktree: (worktreeId: string) => string | null;
  inspectRemainingWorktrees: (repositoryRoot: string) => WorktreeEntry[];
  resolveDefaultThreadContext: (
    worktreeId: string,
    options: { createIfMissing: boolean },
  ) => Promise<SelectedThreadContext | null>;
  switchContextInBackground: (context: SelectedThreadContext) => void;
  getSelectedWorktreeId: () => string | null;
  removeWorktreeFromGit: (input: {
    worktreePath: string;
    repositoryRoot: string;
  }) => void;
};

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

export function createWorkspaceRemovalActions(
  dependencies: CreateWorkspaceRemovalActionsDependencies,
) {
  const {
    getRepository,
    listRepositories,
    inspectRepositoryWorktrees,
    listThreadsByWorktree,
    deleteThread,
    removeWorkspaceSession,
    runBestEffortRemoveWorktree,
    removeRepository,
    removeRepositoryPreferences,
    getSelectedRepositoryId,
    clearSelection,
    notifySessionChanged,
    activateWorkspacePath,
    getRepositoryIdForWorktree,
    inspectRemainingWorktrees,
    resolveDefaultThreadContext,
    switchContextInBackground,
    getSelectedWorktreeId,
    removeWorktreeFromGit,
  } = dependencies;

  async function removeRepositoryAction(repositoryId: string): Promise<void> {
    const repository = getRepository(repositoryId);
    if (!repository) {
      throw new Error(`Unknown repository: ${repositoryId}`);
    }

    const isActiveRepository = getSelectedRepositoryId() === repository.id;
    const worktrees = inspectRepositoryWorktrees(repository.rootPath);

    for (const worktree of worktrees) {
      if (worktree.path === repository.rootPath) {
        continue;
      }

      const threads = listThreadsByWorktree(worktree.path);
      for (const thread of threads) {
        deleteThread(thread.id);
      }

      removeWorkspaceSession(worktree.path);
      runBestEffortRemoveWorktree({
        worktreePath: worktree.path,
        repositoryRoot: repository.rootPath,
      });
    }

    const mainThreads = listThreadsByWorktree(repository.rootPath);
    for (const thread of mainThreads) {
      deleteThread(thread.id);
    }
    removeWorkspaceSession(repository.rootPath);

    removeRepository(repositoryId);
    removeRepositoryPreferences(repositoryId);

    const remainingRepositories = listRepositories();
    if (remainingRepositories.length === 0) {
      clearSelection();
      notifySessionChanged();
      return;
    }

    if (!isActiveRepository) {
      notifySessionChanged();
      return;
    }

    const nextRepository = remainingRepositories[0];
    if (!nextRepository) {
      clearSelection();
      notifySessionChanged();
      return;
    }

    await activateWorkspacePath(
      nextRepository.lastSelectedWorktreeId ?? nextRepository.rootPath,
    );
    notifySessionChanged();
  }

  async function removeWorktreeAction(worktreeId: string): Promise<void> {
    const normalizedWorktreeId = normalizePathId(worktreeId);
    const repositoryId = getRepositoryIdForWorktree(normalizedWorktreeId);
    const repository = repositoryId ? getRepository(repositoryId) : null;

    if (!repository) {
      throw new Error(`Cannot find repository for worktree: ${worktreeId}`);
    }

    const isActiveWorktree = getSelectedWorktreeId() === normalizedWorktreeId;
    const threadsInWorktree = listThreadsByWorktree(normalizedWorktreeId);
    for (const thread of threadsInWorktree) {
      deleteThread(thread.id);
    }

    removeWorktreeFromGit({
      worktreePath: normalizedWorktreeId,
      repositoryRoot: repository.rootPath,
    });

    if (isActiveWorktree) {
      const remainingWorktrees = inspectRemainingWorktrees(repository.rootPath);
      const nextWorktree = remainingWorktrees.find(
        (worktree) => worktree.path !== normalizedWorktreeId,
      );

      if (nextWorktree) {
        const context = await resolveDefaultThreadContext(nextWorktree.path, {
          createIfMissing: true,
        });
        if (context) {
          switchContextInBackground(context);
          return;
        }
      }

      const remainingRepositories = listRepositories().filter(
        (entry) => entry.id !== repositoryId,
      );
      const nextRepository = remainingRepositories[0];

      if (nextRepository) {
        await activateWorkspacePath(
          nextRepository.lastSelectedWorktreeId ?? nextRepository.rootPath,
        );
      } else {
        clearSelection();
      }
    }

    notifySessionChanged();
  }

  return {
    removeRepository: removeRepositoryAction,
    removeWorktree: removeWorktreeAction,
  };
}
