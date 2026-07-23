import type { GitFileDiff, GitRepositoryStatus } from "@pi-desktop/shared";
import type { Effect } from "effect";
import type { GitError } from "../effect/errors";
import {
  type GitRepositoryInspection,
  GitWorktreeService,
} from "../git-worktree-service";

/**
 * Public Git capability used by IPC, shell snapshot, and Effect Layers.
 * Backed by focused modules under `git/` (status, worktrees, diff, staging,
 * remote/cache) — callers depend on this surface, not the class constructor.
 */
export type GitService = {
  inspect(targetPath: string): GitRepositoryInspection;
  inspectAsync(targetPath: string): Promise<GitRepositoryInspection>;
  isRepository(targetPath: string): boolean;
  init(targetPath: string): void;
  createWorktree(options: {
    repositoryRoot: string;
    branchName: string;
    worktreePath: string;
    baseBranch?: string;
  }): string;
  removeWorktree(options: {
    worktreePath: string;
    repositoryRoot: string;
  }): void;
  getRepositoryStatus(
    repositoryPath: string,
    options?: { force?: boolean },
  ): GitRepositoryStatus;
  stageFile(repositoryPath: string, filePath: string): GitRepositoryStatus;
  stageFiles(repositoryPath: string, filePaths: string[]): GitRepositoryStatus;
  unstageFile(repositoryPath: string, filePath: string): GitRepositoryStatus;
  unstageFiles(
    repositoryPath: string,
    filePaths: string[],
  ): GitRepositoryStatus;
  discardFile(repositoryPath: string, filePath: string): GitRepositoryStatus;
  commit(repositoryPath: string, message: string): GitRepositoryStatus;
  push(repositoryPath: string): GitRepositoryStatus;
  pull(repositoryPath: string): GitRepositoryStatus;
  fetch(repositoryPath: string): GitRepositoryStatus;
  diffFile(
    repositoryPath: string,
    filePath: string,
    staged: boolean,
  ): GitFileDiff;
  inspectEffect(
    targetPath: string,
  ): Effect.Effect<GitRepositoryInspection, GitError>;
  getRepositoryStatusEffect(
    repositoryPath: string,
    options?: { force?: boolean },
  ): Effect.Effect<GitRepositoryStatus, GitError>;
};

export function createGitService(): GitService {
  return new GitWorktreeService();
}

export type { GitRepositoryInspection };
