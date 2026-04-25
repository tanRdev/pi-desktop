import fs from "node:fs";
import path from "node:path";
import type {
  GitFileDiff,
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeGitSnapshot,
} from "@pi-desktop/shared";
import type { Effect } from "effect";
import { GitError } from "./effect/errors";
import {
  clearAllGitWorktreeCaches,
  clearGitWorktreeCachesForPath,
} from "./git/cache-invalidation";
import {
  createGitAsyncEffect,
  createGitSyncEffect,
} from "./git/effect-wrappers";
import { buildFileDiff } from "./git/file-diff";
import {
  type RunGit,
  type RunGitAsync,
  runGitCommand,
  runGitCommandAsync,
} from "./git/git-command-runner";
import { runCheckedGitCommand } from "./git/git-command-status";
import { buildRepositoryInspection } from "./git/inspection";
import { buildInspectionCacheEntries } from "./git/inspection-outcomes";
import {
  normalizePathId,
  resolveCommandCwd,
  resolveInsideRepository,
} from "./git/path-utils";
import {
  loadRepositoryInspection,
  loadRepositoryInspectionAsync,
} from "./git/repository-inspection-loader";
import {
  detectDefaultBranch,
  detectDefaultBranchAsync,
  resolveAbsoluteGitDir,
  resolveAbsoluteGitDirAsync,
  resolveCommonGitDir,
  resolveCommonGitDirAsync,
  resolveCurrentWorktreeRoot,
  resolveCurrentWorktreeRootAsync,
  resolveUpstreamBranch,
} from "./git/repository-meta";
import { buildRepositoryStatusFromPorcelain } from "./git/repository-status";
import { loadRepositoryStatus } from "./git/repository-status-loader";
import { createStatusChangingCommandRunner } from "./git/status-changing-command-runner";
import {
  buildCommitCommand,
  buildDiscardTrackedFileCommand,
  buildFetchCommand,
  buildPullCommand,
  buildPushCommand,
  buildStageFileCommand,
  buildStageFilesCommand,
  buildUnstageFileCommand,
  buildUnstageFilesCommand,
} from "./git/status-changing-commands";
import { type ParsedWorktree, parseWorktreeBlocks } from "./git/status-parsers";
import { buildCreateWorktreeCommand } from "./git/worktree-creation";
import {
  inspectWorktreeGitSummary,
  inspectWorktreeGitSummaryAsync,
} from "./git/worktree-git-summary";
import {
  inspectParsedWorktree,
  inspectParsedWorktreeAsync,
} from "./git/worktree-inspection";
import { LruMap } from "./lru-map";

export interface GitWorktreeSummary {
  id: string;
  path: string;
  isMain: boolean;
  isCurrent: boolean;
  isDetached: boolean;
  isPrunable: boolean;
  prunableReason: string | null;
  branch: string | null;
  commit: string | null;
  git: WorktreeGitSnapshot;
}

export interface GitRepositoryInspection {
  status: "repository" | "not_repo" | "unavailable";
  rootPath?: string;
  currentWorktreePath?: string;
  defaultBranch?: string | null;
  worktrees?: GitWorktreeSummary[];
  currentGit?: ShellGitSnapshot;
  message: string | null;
}

export class GitWorktreeService {
  private static readonly INSPECTION_CACHE_TTL = 2000;
  private static readonly STATUS_CACHE_TTL = 2000;
  private static readonly INSPECTION_CACHE_MAX_ENTRIES = 200;
  private static readonly STATUS_CACHE_MAX_ENTRIES = 200;

  private readonly inspectionCache = new LruMap<
    string,
    { inspection: GitRepositoryInspection; updatedAt: number }
  >(GitWorktreeService.INSPECTION_CACHE_MAX_ENTRIES);

  private readonly repositoryStatusCache = new LruMap<
    string,
    { status: GitRepositoryStatus; updatedAt: number }
  >(GitWorktreeService.STATUS_CACHE_MAX_ENTRIES);

  private readonly runGit: RunGit = runGitCommand;

  private readonly runGitAsync: RunGitAsync = runGitCommandAsync;

  private readonly runStatusChangingCommand = createStatusChangingCommandRunner(
    {
      runGit: this.runGit,
      clearCachesForPath: (targetPath) => this.clearCachesForPath(targetPath),
      getRepositoryStatus: (targetPath) => this.getRepositoryStatus(targetPath),
    },
  );

  inspect(targetPath: string): GitRepositoryInspection {
    const cacheKey = normalizePathId(resolveCommandCwd(targetPath));
    const cachedInspection = this.inspectionCache.get(cacheKey);
    if (
      cachedInspection &&
      Date.now() - cachedInspection.updatedAt <
        GitWorktreeService.INSPECTION_CACHE_TTL
    ) {
      return cachedInspection.inspection;
    }

    const inspection = loadRepositoryInspection({
      targetPath,
      resolveCommandCwd,
      resolveCurrentWorktreeRoot: (commandCwd) =>
        resolveCurrentWorktreeRoot(this.runGit, commandCwd),
      resolveCommonGitDir: (currentWorktreeRoot) =>
        resolveCommonGitDir(this.runGit, currentWorktreeRoot),
      runWorktreeList: (currentWorktreeRoot) =>
        this.runGit(currentWorktreeRoot, ["worktree", "list", "--porcelain"]),
      parseWorktreeList: parseWorktreeBlocks,
      inspectWorktree: (entry, currentWorktreeRoot, commonGitDir) =>
        this.inspectWorktree(entry, currentWorktreeRoot, commonGitDir),
      detectDefaultBranch: (currentWorktreeRoot, fallbackBranch) =>
        detectDefaultBranch(this.runGit, currentWorktreeRoot, fallbackBranch),
      buildInspection: buildRepositoryInspection,
    });

    this.cacheInspection(cacheKey, inspection);

    return inspection;
  }

  async inspectAsync(targetPath: string): Promise<GitRepositoryInspection> {
    const cacheKey = normalizePathId(resolveCommandCwd(targetPath));
    const cachedInspection = this.inspectionCache.get(cacheKey);
    if (
      cachedInspection &&
      Date.now() - cachedInspection.updatedAt <
        GitWorktreeService.INSPECTION_CACHE_TTL
    ) {
      return cachedInspection.inspection;
    }

    const inspection = await loadRepositoryInspectionAsync({
      targetPath,
      resolveCommandCwd,
      resolveCurrentWorktreeRoot: (commandCwd) =>
        resolveCurrentWorktreeRootAsync(this.runGitAsync, commandCwd),
      resolveCommonGitDir: (currentWorktreeRoot) =>
        resolveCommonGitDirAsync(this.runGitAsync, currentWorktreeRoot),
      runWorktreeList: (currentWorktreeRoot) =>
        this.runGitAsync(currentWorktreeRoot, [
          "worktree",
          "list",
          "--porcelain",
        ]),
      parseWorktreeList: parseWorktreeBlocks,
      inspectWorktree: (entry, currentWorktreeRoot, commonGitDir) =>
        this.inspectWorktreeAsync(entry, currentWorktreeRoot, commonGitDir),
      detectDefaultBranch: (currentWorktreeRoot, fallbackBranch) =>
        detectDefaultBranchAsync(
          this.runGitAsync,
          currentWorktreeRoot,
          fallbackBranch,
        ),
      buildInspection: buildRepositoryInspection,
    });

    this.cacheInspection(cacheKey, inspection);

    return inspection;
  }

  isRepository(targetPath: string): boolean {
    return this.inspect(targetPath).status === "repository";
  }

  init(targetPath: string): void {
    this.runCheckedGit(targetPath, ["init"], "initialize git repository");
  }

  createWorktree(options: {
    repositoryRoot: string;
    branchName: string;
    worktreePath: string;
    baseBranch?: string;
  }): string {
    const repositoryRoot = normalizePathId(options.repositoryRoot);
    const worktreePath = path.resolve(options.worktreePath);
    const branchName = options.branchName.trim();

    if (!branchName) {
      throw new Error("Worktree branch name must not be empty");
    }

    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

    const args = buildCreateWorktreeCommand(this.runGit, {
      repositoryRoot,
      branchName,
      worktreePath,
      baseBranch: options.baseBranch,
    });

    const result = this.runGit(repositoryRoot, args);
    if (result.error || result.status !== 0) {
      throw new Error(
        result.error?.message ||
          result.stderr.trim() ||
          `Failed to create worktree for branch ${branchName}`,
      );
    }

    return normalizePathId(worktreePath);
  }

  removeWorktree(options: {
    worktreePath: string;
    repositoryRoot: string;
  }): void {
    const worktreePath = normalizePathId(options.worktreePath);
    const repositoryRoot = normalizePathId(options.repositoryRoot);

    if (!fs.existsSync(worktreePath)) {
      this.runGit(repositoryRoot, ["worktree", "prune"]);
      this.clearCaches();
      return;
    }

    this.runCheckedGit(
      repositoryRoot,
      ["worktree", "remove", "--force", worktreePath],
      "remove worktree",
    );
    this.runGit(repositoryRoot, ["worktree", "prune"]);
    this.clearCaches();
  }

  getRepositoryStatus(
    repositoryPath: string,
    options: { force?: boolean } = {},
  ): GitRepositoryStatus {
    if (options.force) {
      this.clearCachesForPath(repositoryPath);
    }

    const normalizedRepositoryPath = normalizePathId(repositoryPath);
    const cachedStatus = this.repositoryStatusCache.get(
      normalizedRepositoryPath,
    );
    if (
      cachedStatus &&
      Date.now() - cachedStatus.updatedAt < GitWorktreeService.STATUS_CACHE_TTL
    ) {
      return cachedStatus.status;
    }

    const status = loadRepositoryStatus({
      repositoryPath,
      inspectRepository: () => this.inspect(repositoryPath),
      runGit: this.runGit,
      resolveUpstreamBranch,
      buildRepositoryStatus: buildRepositoryStatusFromPorcelain,
    });

    this.repositoryStatusCache.set(normalizedRepositoryPath, {
      status,
      updatedAt: Date.now(),
    });

    return status;
  }

  stageFile(repositoryPath: string, filePath: string): GitRepositoryStatus {
    return this.runStatusChangingCommand(
      repositoryPath,
      buildStageFileCommand(filePath),
    );
  }

  stageFiles(repositoryPath: string, filePaths: string[]): GitRepositoryStatus {
    if (filePaths.length === 0) {
      return this.getRepositoryStatus(repositoryPath);
    }

    return this.runStatusChangingCommand(
      repositoryPath,
      buildStageFilesCommand(filePaths),
    );
  }

  unstageFile(repositoryPath: string, filePath: string): GitRepositoryStatus {
    return this.runStatusChangingCommand(
      repositoryPath,
      buildUnstageFileCommand(filePath),
    );
  }

  unstageFiles(
    repositoryPath: string,
    filePaths: string[],
  ): GitRepositoryStatus {
    if (filePaths.length === 0) {
      return this.getRepositoryStatus(repositoryPath);
    }

    return this.runStatusChangingCommand(
      repositoryPath,
      buildUnstageFilesCommand(filePaths),
    );
  }

  discardFile(repositoryPath: string, filePath: string): GitRepositoryStatus {
    // Guard against traversal: only operate on paths resolved inside the repo.
    const absolutePath = resolveInsideRepository(repositoryPath, filePath);

    const status = this.getRepositoryStatus(repositoryPath);
    const isUntracked = status.unstagedChanges.some(
      (change) => change.path === filePath && change.status === "untracked",
    );

    if (isUntracked) {
      fs.rmSync(absolutePath, { force: true, recursive: true });
      this.clearCaches();
      return this.getRepositoryStatus(repositoryPath);
    }

    return this.runStatusChangingCommand(
      repositoryPath,
      buildDiscardTrackedFileCommand(filePath),
    );
  }

  commit(repositoryPath: string, message: string): GitRepositoryStatus {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error("Commit message must not be empty");
    }

    return this.runStatusChangingCommand(
      repositoryPath,
      buildCommitCommand(trimmed),
    );
  }

  pull(repositoryPath: string): GitRepositoryStatus {
    return this.runStatusChangingCommand(repositoryPath, buildPullCommand());
  }

  push(repositoryPath: string): GitRepositoryStatus {
    return this.runStatusChangingCommand(repositoryPath, buildPushCommand());
  }

  fetch(repositoryPath: string): GitRepositoryStatus {
    return this.runStatusChangingCommand(repositoryPath, buildFetchCommand());
  }

  diffFile(
    repositoryPath: string,
    filePath: string,
    staged: boolean,
  ): GitFileDiff {
    const args = staged
      ? ["diff", "--cached", "--unified=3", "--", filePath]
      : ["diff", "--unified=3", "--", filePath];

    const result = this.runGit(repositoryPath, args);

    if (result.status !== 0 && !result.stdout) {
      throw new Error(
        result.error?.message || result.stderr.trim() || "Failed to get diff",
      );
    }

    const status = this.getRepositoryStatus(repositoryPath);
    return buildFileDiff({
      runGit: this.runGit,
      repositoryPath,
      filePath,
      status,
      result,
    });
  }

  private inspectWorktree(
    entry: ParsedWorktree,
    currentWorktreeRoot: string,
    commonGitDir: string,
  ): GitWorktreeSummary {
    return inspectParsedWorktree({
      entry,
      currentWorktreeRoot,
      commonGitDir,
      existsSync: (targetPath) => fs.existsSync(targetPath),
      resolveAbsoluteGitDir: (worktreePath) =>
        resolveAbsoluteGitDir(this.runGit, worktreePath),
      inspectWorktreeGit: (worktreePath, fallback) =>
        this.inspectWorktreeGit(worktreePath, fallback),
    });
  }

  private inspectWorktreeGit(
    worktreePath: string,
    fallback: {
      branch: string | null;
      commit: string | null;
      message: string | null;
    },
  ): WorktreeGitSnapshot {
    return inspectWorktreeGitSummary(this.runGit, worktreePath, fallback);
  }

  private async inspectWorktreeAsync(
    entry: ParsedWorktree,
    currentWorktreeRoot: string,
    commonGitDir: string,
  ): Promise<GitWorktreeSummary> {
    return inspectParsedWorktreeAsync({
      entry,
      currentWorktreeRoot,
      commonGitDir,
      existsSync: (targetPath) => fs.existsSync(targetPath),
      resolveAbsoluteGitDirAsync: (worktreePath) =>
        resolveAbsoluteGitDirAsync(this.runGitAsync, worktreePath),
      inspectWorktreeGitAsync: (worktreePath, fallback) =>
        this.inspectWorktreeGitAsync(worktreePath, fallback),
    });
  }

  private async inspectWorktreeGitAsync(
    worktreePath: string,
    fallback: {
      branch: string | null;
      commit: string | null;
      message: string | null;
    },
  ): Promise<WorktreeGitSnapshot> {
    return inspectWorktreeGitSummaryAsync(
      this.runGitAsync,
      worktreePath,
      fallback,
    );
  }

  private runCheckedGit(cwd: string, args: string[], label: string): void {
    runCheckedGitCommand({
      runGit: this.runGit,
      cwd,
      args,
      label,
      clearCachesForPath: (targetPath) => this.clearCachesForPath(targetPath),
    });
  }

  private cacheInspection(
    cacheKey: string,
    inspection: GitRepositoryInspection,
  ): void {
    const timestamp = Date.now();

    for (const [key, entry] of buildInspectionCacheEntries({
      cacheKey,
      inspection,
      updatedAt: timestamp,
    })) {
      this.inspectionCache.set(key, entry);
    }
  }

  private clearCachesForPath(targetPath: string): void {
    clearGitWorktreeCachesForPath({
      targetPath,
      now: Date.now(),
      inspectionCache: this.inspectionCache,
      inspectionTtl: GitWorktreeService.INSPECTION_CACHE_TTL,
      repositoryStatusCache: this.repositoryStatusCache,
      statusTtl: GitWorktreeService.STATUS_CACHE_TTL,
    });
  }

  private clearCaches(): void {
    clearAllGitWorktreeCaches({
      inspectionCache: this.inspectionCache,
      repositoryStatusCache: this.repositoryStatusCache,
    });
  }

  // ---------------------------------------------------------------------------
  // Effect-based method variants
  //
  // These wrap the synchronous / async public methods in Effect pipelines so
  // that callers written in the Effect style can compose them without managing
  // try/catch manually.  The public API (the non-Effect methods above) is
  // intentionally left untouched — external callers keep their existing
  // contracts.
  // ---------------------------------------------------------------------------

  private gitError(message: string, path?: string, cause?: unknown): GitError {
    return new GitError({ code: "EGIT_FAILED", message, path, cause });
  }

  inspectEffect(
    targetPath: string,
  ): Effect.Effect<GitRepositoryInspection, GitError> {
    return createGitSyncEffect({
      try: () => this.inspect(targetPath),
      catch: (e) =>
        this.gitError(
          `Failed to inspect repository at ${targetPath}`,
          targetPath,
          e,
        ),
    });
  }

  inspectAsyncEffect(
    targetPath: string,
  ): Effect.Effect<GitRepositoryInspection, GitError> {
    return createGitAsyncEffect({
      try: () => this.inspectAsync(targetPath),
      catch: (e) =>
        this.gitError(
          `Failed to inspect repository at ${targetPath}`,
          targetPath,
          e,
        ),
    });
  }

  createWorktreeEffect(options: {
    repositoryRoot: string;
    branchName: string;
    worktreePath: string;
    baseBranch?: string;
  }): Effect.Effect<string, GitError> {
    return createGitSyncEffect({
      try: () => this.createWorktree(options),
      catch: (e) =>
        this.gitError(
          `Failed to create worktree for branch ${options.branchName}`,
          options.repositoryRoot,
          e,
        ),
    });
  }

  removeWorktreeEffect(options: {
    worktreePath: string;
    repositoryRoot: string;
  }): Effect.Effect<void, GitError> {
    return createGitSyncEffect({
      try: () => this.removeWorktree(options),
      catch: (e) =>
        this.gitError(
          `Failed to remove worktree at ${options.worktreePath}`,
          options.worktreePath,
          e,
        ),
    });
  }

  getRepositoryStatusEffect(
    repositoryPath: string,
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.getRepositoryStatus(repositoryPath),
      catch: (e) =>
        this.gitError(
          `Failed to get repository status at ${repositoryPath}`,
          repositoryPath,
          e,
        ),
    });
  }

  stageFileEffect(
    repositoryPath: string,
    filePath: string,
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.stageFile(repositoryPath, filePath),
      catch: (e) =>
        this.gitError(`Failed to stage file ${filePath}`, repositoryPath, e),
    });
  }

  stageFilesEffect(
    repositoryPath: string,
    filePaths: string[],
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.stageFiles(repositoryPath, filePaths),
      catch: (e) => this.gitError(`Failed to stage files`, repositoryPath, e),
    });
  }

  unstageFileEffect(
    repositoryPath: string,
    filePath: string,
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.unstageFile(repositoryPath, filePath),
      catch: (e) =>
        this.gitError(`Failed to unstage file ${filePath}`, repositoryPath, e),
    });
  }

  unstageFilesEffect(
    repositoryPath: string,
    filePaths: string[],
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.unstageFiles(repositoryPath, filePaths),
      catch: (e) => this.gitError(`Failed to unstage files`, repositoryPath, e),
    });
  }

  discardFileEffect(
    repositoryPath: string,
    filePath: string,
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.discardFile(repositoryPath, filePath),
      catch: (e) =>
        this.gitError(`Failed to discard file ${filePath}`, repositoryPath, e),
    });
  }

  commitEffect(
    repositoryPath: string,
    message: string,
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.commit(repositoryPath, message),
      catch: (e) =>
        this.gitError(
          `Failed to commit at ${repositoryPath}`,
          repositoryPath,
          e,
        ),
    });
  }

  pullEffect(
    repositoryPath: string,
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.pull(repositoryPath),
      catch: (e) =>
        this.gitError(`Failed to pull at ${repositoryPath}`, repositoryPath, e),
    });
  }

  pushEffect(
    repositoryPath: string,
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.push(repositoryPath),
      catch: (e) =>
        this.gitError(`Failed to push at ${repositoryPath}`, repositoryPath, e),
    });
  }

  fetchEffect(
    repositoryPath: string,
  ): Effect.Effect<GitRepositoryStatus, GitError> {
    return createGitSyncEffect({
      try: () => this.fetch(repositoryPath),
      catch: (e) =>
        this.gitError(
          `Failed to fetch at ${repositoryPath}`,
          repositoryPath,
          e,
        ),
    });
  }

  diffFileEffect(
    repositoryPath: string,
    filePath: string,
    staged: boolean,
  ): Effect.Effect<GitFileDiff, GitError> {
    return createGitSyncEffect({
      try: () => this.diffFile(repositoryPath, filePath, staged),
      catch: (e) =>
        this.gitError(`Failed to diff file ${filePath}`, repositoryPath, e),
    });
  }
}
