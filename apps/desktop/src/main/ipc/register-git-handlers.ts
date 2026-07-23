import { existsSync } from "node:fs";
import { gitContracts, registerContractHandler } from "@pi-desktop/contracts";
import type { GitRepositoryStatus } from "@pi-desktop/shared";
import { PathGuardError, resolveInsideRoot } from "../fs/path-guards";
import type { GitWorktreeService } from "../git-worktree-service";
import type { IpcRegistrar } from "../ipc-router";

/**
 * Synthetic empty status returned by `git:getRepositoryStatus` when the
 * requested path is no longer a usable git repository (deleted directory,
 * stale catalog entry, or never a repo to begin with).
 *
 * Returning this instead of throwing prevents noisy IPC error logs for a
 * condition the user cannot act on. The renderer treats this as "no git
 * data" and degrades gracefully, matching its existing fallback behavior.
 */
function buildUnavailableRepositoryStatus(
  repositoryPath: string,
): GitRepositoryStatus {
  return {
    repositoryPath,
    branch: null,
    commit: null,
    upstreamBranch: null,
    summary: {
      status: "unavailable",
      branch: null,
      commit: null,
      hasChanges: false,
      ahead: null,
      behind: null,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: null,
    },
    stagedChanges: [],
    unstagedChanges: [],
    conflictedChanges: [],
  };
}

interface RegisterGitHandlersDependencies {
  handle: IpcRegistrar["handle"];
  gitService: GitWorktreeService;
  getAllowedRepositoryRoots: () => readonly string[];
}

function resolveAllowedRepositoryPath(
  repositoryPath: string,
  getAllowedRepositoryRoots: () => readonly string[],
): string {
  const allowedRoots = getAllowedRepositoryRoots();
  return resolveInsideRoot(allowedRoots, repositoryPath);
}

export function registerGitHandlers({
  handle,
  gitService,
  getAllowedRepositoryRoots,
}: RegisterGitHandlersDependencies): void {
  registerContractHandler({
    handle,
    contract: gitContracts.getRepositoryStatus,
    handler: async ({ repositoryPath, force }) => {
      const allowedRoots = getAllowedRepositoryRoots();

      let resolvedPath: string;
      try {
        resolvedPath = resolveInsideRoot(allowedRoots, repositoryPath);
      } catch (error) {
        if (
          error instanceof PathGuardError &&
          error.code === "path/outside-root" &&
          !existsSync(repositoryPath)
        ) {
          return buildUnavailableRepositoryStatus(repositoryPath);
        }
        throw error;
      }

      if (!existsSync(resolvedPath) || !gitService.isRepository(resolvedPath)) {
        return buildUnavailableRepositoryStatus(resolvedPath);
      }

      return gitService.getRepositoryStatus(resolvedPath, {
        force: force ?? false,
      });
    },
  });

  registerContractHandler({
    handle,
    contract: gitContracts.isRepository,
    handler: ({ repositoryPath }) => gitService.isRepository(repositoryPath),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.init,
    handler: async ({ repositoryPath }) => {
      gitService.init(repositoryPath);
    },
  });

  registerContractHandler({
    handle,
    contract: gitContracts.stageFile,
    handler: ({ repositoryPath, filePath }) =>
      gitService.stageFile(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
        filePath,
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.stageFiles,
    handler: ({ repositoryPath, filePaths }) =>
      gitService.stageFiles(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
        [...filePaths],
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.unstageFile,
    handler: ({ repositoryPath, filePath }) =>
      gitService.unstageFile(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
        filePath,
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.unstageFiles,
    handler: ({ repositoryPath, filePaths }) =>
      gitService.unstageFiles(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
        [...filePaths],
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.discardFile,
    handler: ({ repositoryPath, filePath }) =>
      gitService.discardFile(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
        filePath,
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.commit,
    handler: ({ repositoryPath, message }) =>
      gitService.commit(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
        message,
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.pull,
    handler: ({ repositoryPath }) =>
      gitService.pull(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.push,
    handler: ({ repositoryPath }) =>
      gitService.push(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.fetch,
    handler: ({ repositoryPath }) =>
      gitService.fetch(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
      ),
  });

  registerContractHandler({
    handle,
    contract: gitContracts.diffFile,
    handler: ({ repositoryPath, filePath, staged }) =>
      gitService.diffFile(
        resolveAllowedRepositoryPath(repositoryPath, getAllowedRepositoryRoots),
        filePath,
        staged,
      ),
  });
}
