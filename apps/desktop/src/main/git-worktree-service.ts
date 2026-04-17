import { execFile, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type {
  GitDiffHunk,
  GitDiffLine,
  GitFileChange,
  GitFileChangeStatus,
  GitFileDiff,
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeGitSnapshot,
} from "@pi-desktop/shared";
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

type GitCommandResult = {
  status: number;
  stdout: string;
  stderr: string;
  error: Error | null;
};

type ParsedWorktree = {
  path: string;
  head: string | null;
  branchRef: string | null;
  detached: boolean;
  prunableReason: string | null;
};

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);

  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved.replace(/[\\/]+$/, "") || resolved;
  }
}

function resolveCommandCwd(targetPath: string): string {
  const resolved = path.resolve(targetPath);

  try {
    return fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved;
  } catch {
    return resolved;
  }
}

/**
 * Resolve a repo-relative path against a repository root, guaranteeing the
 * result stays inside the repo tree. Rejects absolute inputs, `..` segments,
 * and Windows-drive escapes. Returns the resolved absolute path on success.
 */
function resolveInsideRepository(
  repositoryPath: string,
  relativeFilePath: string,
): string {
  if (typeof relativeFilePath !== "string" || relativeFilePath.length === 0) {
    throw new Error("File path must be a non-empty string");
  }
  if (path.isAbsolute(relativeFilePath)) {
    throw new Error("File path must be relative to the repository root");
  }

  const repoRoot = path.resolve(repositoryPath);
  const candidate = path.resolve(repoRoot, relativeFilePath);
  const relative = path.relative(repoRoot, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Refusing to operate on path outside repository: ${relativeFilePath}`,
    );
  }
  return candidate;
}

function parseBranchName(branchRef: string | null): string | null {
  if (!branchRef) {
    return null;
  }

  return branchRef.replace(/^refs\/heads\//, "");
}

function parseRemoteHeadBranch(symbolicRef: string): string | null {
  const trimmed = symbolicRef.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split("/");
  return parts[parts.length - 1] ?? null;
}

function createMissingGitSummary(reason: string | null): WorktreeGitSnapshot {
  return {
    status: "missing",
    branch: null,
    commit: null,
    hasChanges: false,
    ahead: 0,
    behind: 0,
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    message: reason,
  };
}

function createUnavailableGitSummary(message: string): WorktreeGitSnapshot {
  return {
    status: "unavailable",
    branch: null,
    commit: null,
    hasChanges: false,
    ahead: 0,
    behind: 0,
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    message,
  };
}

function mapPorcelainStatus(code: string): GitFileChangeStatus {
  switch (code) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type_changed";
    case "U":
      return "unmerged";
    case "?":
      return "untracked";
    default:
      return "unknown";
  }
}

function parseGitFileChange(line: string): GitFileChange | null {
  if (!line) {
    return null;
  }

  if (line.startsWith("?? ")) {
    const filePath = line.slice(3).trim();
    return filePath
      ? {
          path: filePath,
          status: "untracked",
          indexStatus: null,
          worktreeStatus: "untracked",
        }
      : null;
  }

  if (line.length < 4) {
    return null;
  }

  const indexCode = line[0] ?? " ";
  const worktreeCode = line[1] ?? " ";
  const filePath = line.slice(3).trim().split(" -> ").pop()?.trim() ?? "";

  if (!filePath) {
    return null;
  }

  const indexStatus = indexCode === " " ? null : mapPorcelainStatus(indexCode);
  const worktreeStatus =
    worktreeCode === " " ? null : mapPorcelainStatus(worktreeCode);

  return {
    path: filePath,
    status: indexStatus ?? worktreeStatus ?? "unknown",
    indexStatus,
    worktreeStatus,
  };
}

function parseWorktreeBlocks(output: string): ParsedWorktree[] {
  const blocks = output
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const parsed: ParsedWorktree = {
      path: "",
      head: null,
      branchRef: null,
      detached: false,
      prunableReason: null,
    };

    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) {
        parsed.path = normalizePathId(line.replace("worktree ", ""));
        continue;
      }
      if (line.startsWith("HEAD ")) {
        parsed.head = line.replace("HEAD ", "").trim();
        continue;
      }
      if (line.startsWith("branch ")) {
        parsed.branchRef = line.replace("branch ", "").trim();
        continue;
      }
      if (line === "detached") {
        parsed.detached = true;
        continue;
      }
      if (line.startsWith("prunable ")) {
        parsed.prunableReason = line.replace("prunable ", "").trim() || null;
      }
    }

    return parsed;
  });
}

const execFileAsync = promisify(execFile);

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

    const commandCwd = resolveCommandCwd(targetPath);
    const currentWorktreeRoot = this.resolveCurrentWorktreeRoot(commandCwd);

    if (!currentWorktreeRoot) {
      const inspection: GitRepositoryInspection = {
        status: "not_repo",
        message: null,
      };
      this.inspectionCache.set(cacheKey, {
        inspection,
        updatedAt: Date.now(),
      });
      return inspection;
    }

    const commonGitDir = this.resolveCommonGitDir(currentWorktreeRoot);
    if (!commonGitDir) {
      const inspection: GitRepositoryInspection = {
        status: "unavailable",
        message: "Failed to resolve the common git directory",
      };
      this.inspectionCache.set(cacheKey, {
        inspection,
        updatedAt: Date.now(),
      });
      return inspection;
    }

    const worktreeList = this.runGit(currentWorktreeRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]);
    if (worktreeList.error) {
      const inspection: GitRepositoryInspection = {
        status: "unavailable",
        message: worktreeList.error.message,
      };
      this.inspectionCache.set(cacheKey, {
        inspection,
        updatedAt: Date.now(),
      });
      return inspection;
    }
    if (worktreeList.status !== 0) {
      const inspection: GitRepositoryInspection = {
        status: "unavailable",
        message: worktreeList.stderr.trim() || "Failed to list git worktrees",
      };
      this.inspectionCache.set(cacheKey, {
        inspection,
        updatedAt: Date.now(),
      });
      return inspection;
    }

    const parsedWorktrees = parseWorktreeBlocks(worktreeList.stdout);
    const worktrees = parsedWorktrees
      .map((entry) =>
        this.inspectWorktree(entry, currentWorktreeRoot, commonGitDir),
      )
      .sort((left, right) => {
        if (left.isMain !== right.isMain) {
          return left.isMain ? -1 : 1;
        }
        return left.path.localeCompare(right.path);
      });

    const mainWorktree = worktrees.find((worktree) => worktree.isMain);
    const currentWorktree =
      worktrees.find((worktree) => worktree.path === currentWorktreeRoot) ??
      worktrees[0] ??
      null;
    const rootPath = mainWorktree?.path ?? currentWorktreeRoot;
    const defaultBranch = this.detectDefaultBranch(
      currentWorktreeRoot,
      mainWorktree?.branch ?? null,
    );

    const inspection: GitRepositoryInspection = {
      status: "repository",
      rootPath,
      currentWorktreePath: currentWorktree?.path ?? currentWorktreeRoot,
      defaultBranch,
      worktrees,
      currentGit: currentWorktree
        ? {
            status: "repository",
            rootPath,
            branch: currentWorktree.isDetached
              ? "HEAD"
              : (currentWorktree.branch ?? undefined),
            commit: currentWorktree.commit ?? undefined,
            hasChanges: currentWorktree.git.hasChanges,
            ahead: currentWorktree.git.ahead ?? 0,
            behind: currentWorktree.git.behind ?? 0,
            stagedCount: currentWorktree.git.stagedCount,
            modifiedCount: currentWorktree.git.modifiedCount,
            untrackedCount: currentWorktree.git.untrackedCount,
            message: currentWorktree.git.message,
          }
        : undefined,
      message: null,
    };

    const timestamp = Date.now();
    this.inspectionCache.set(cacheKey, {
      inspection,
      updatedAt: timestamp,
    });
    this.inspectionCache.set(rootPath, {
      inspection,
      updatedAt: timestamp,
    });
    if (inspection.currentWorktreePath) {
      this.inspectionCache.set(inspection.currentWorktreePath, {
        inspection,
        updatedAt: timestamp,
      });
    }

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

    const commandCwd = resolveCommandCwd(targetPath);
    const currentWorktreeRoot =
      await this.resolveCurrentWorktreeRootAsync(commandCwd);

    if (!currentWorktreeRoot) {
      const inspection: GitRepositoryInspection = {
        status: "not_repo",
        message: null,
      };
      this.inspectionCache.set(cacheKey, { inspection, updatedAt: Date.now() });
      return inspection;
    }

    const commonGitDir =
      await this.resolveCommonGitDirAsync(currentWorktreeRoot);
    if (!commonGitDir) {
      const inspection: GitRepositoryInspection = {
        status: "unavailable",
        message: "Failed to resolve the common git directory",
      };
      this.inspectionCache.set(cacheKey, { inspection, updatedAt: Date.now() });
      return inspection;
    }

    const worktreeList = await this.runGitAsync(currentWorktreeRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]);
    if (worktreeList.error) {
      const inspection: GitRepositoryInspection = {
        status: "unavailable",
        message: worktreeList.error.message,
      };
      this.inspectionCache.set(cacheKey, { inspection, updatedAt: Date.now() });
      return inspection;
    }
    if (worktreeList.status !== 0) {
      const inspection: GitRepositoryInspection = {
        status: "unavailable",
        message: worktreeList.stderr.trim() || "Failed to list git worktrees",
      };
      this.inspectionCache.set(cacheKey, { inspection, updatedAt: Date.now() });
      return inspection;
    }

    const parsedWorktrees = parseWorktreeBlocks(worktreeList.stdout);

    const worktrees = await Promise.all(
      parsedWorktrees.map((entry) =>
        this.inspectWorktreeAsync(entry, currentWorktreeRoot, commonGitDir),
      ),
    );
    worktrees.sort((left, right) => {
      if (left.isMain !== right.isMain) return left.isMain ? -1 : 1;
      return left.path.localeCompare(right.path);
    });

    const mainWorktree = worktrees.find((wt) => wt.isMain);
    const currentWorktree =
      worktrees.find((wt) => wt.path === currentWorktreeRoot) ??
      worktrees[0] ??
      null;
    const rootPath = mainWorktree?.path ?? currentWorktreeRoot;
    const defaultBranch = await this.detectDefaultBranchAsync(
      currentWorktreeRoot,
      mainWorktree?.branch ?? null,
    );

    const inspection: GitRepositoryInspection = {
      status: "repository",
      rootPath,
      currentWorktreePath: currentWorktree?.path ?? currentWorktreeRoot,
      defaultBranch,
      worktrees,
      currentGit: currentWorktree
        ? {
            status: "repository" as const,
            rootPath,
            branch: currentWorktree.isDetached
              ? "HEAD"
              : (currentWorktree.branch ?? undefined),
            commit: currentWorktree.commit ?? undefined,
            hasChanges: currentWorktree.git.hasChanges,
            ahead: currentWorktree.git.ahead ?? 0,
            behind: currentWorktree.git.behind ?? 0,
            stagedCount: currentWorktree.git.stagedCount,
            modifiedCount: currentWorktree.git.modifiedCount,
            untrackedCount: currentWorktree.git.untrackedCount,
            message: currentWorktree.git.message,
          }
        : undefined,
      message: null,
    };

    const timestamp = Date.now();
    this.inspectionCache.set(cacheKey, { inspection, updatedAt: timestamp });
    this.inspectionCache.set(rootPath, { inspection, updatedAt: timestamp });
    if (inspection.currentWorktreePath) {
      this.inspectionCache.set(inspection.currentWorktreePath, {
        inspection,
        updatedAt: timestamp,
      });
    }

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

    const branchExists = this.runGit(repositoryRoot, [
      "show-ref",
      "--verify",
      `refs/heads/${branchName}`,
    ]);
    let startRef: string | undefined;

    if (branchExists.status === 0) {
      startRef = undefined;
    } else if (options.baseBranch) {
      const localRef = this.runGit(repositoryRoot, [
        "show-ref",
        "--verify",
        `refs/heads/${options.baseBranch}`,
      ]);
      if (localRef.status === 0) {
        startRef = options.baseBranch;
      } else {
        const remoteRef = this.runGit(repositoryRoot, [
          "show-ref",
          "--verify",
          `refs/remotes/origin/${options.baseBranch}`,
        ]);
        if (remoteRef.status === 0) {
          startRef = `origin/${options.baseBranch}`;
        }
      }
    }

    const args =
      branchExists.status === 0
        ? ["worktree", "add", worktreePath, branchName]
        : startRef
          ? ["worktree", "add", "-b", branchName, worktreePath, startRef]
          : ["worktree", "add", "-b", branchName, worktreePath];

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

  getRepositoryStatus(repositoryPath: string): GitRepositoryStatus {
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

    const inspection = this.inspect(repositoryPath);

    if (
      inspection.status !== "repository" ||
      !inspection.currentWorktreePath ||
      !inspection.worktrees
    ) {
      throw new Error(inspection.message ?? "Git repository is unavailable");
    }

    const currentWorktree = inspection.worktrees.find(
      (worktree) => worktree.path === inspection.currentWorktreePath,
    );

    if (!currentWorktree) {
      throw new Error("Active worktree status is unavailable");
    }

    const porcelainResult = this.runGit(inspection.currentWorktreePath, [
      "status",
      "--porcelain",
    ]);
    if (porcelainResult.error || porcelainResult.status !== 0) {
      throw new Error(
        porcelainResult.error?.message ||
          porcelainResult.stderr.trim() ||
          "Failed to inspect repository status",
      );
    }

    const allChanges = porcelainResult.stdout.split(/\r?\n/).flatMap((line) => {
      const parsed = parseGitFileChange(line);
      return parsed ? [parsed] : [];
    });

    const status: GitRepositoryStatus = {
      repositoryPath: inspection.currentWorktreePath,
      branch: currentWorktree.branch,
      commit: currentWorktree.commit,
      upstreamBranch: this.resolveUpstreamBranch(
        inspection.currentWorktreePath,
      ),
      summary: currentWorktree.git,
      stagedChanges: allChanges.filter((change) => change.indexStatus !== null),
      unstagedChanges: allChanges.filter(
        (change) =>
          change.worktreeStatus !== null &&
          change.worktreeStatus !== "unmerged",
      ),
      conflictedChanges: allChanges.filter(
        (change) =>
          change.status === "unmerged" ||
          change.indexStatus === "unmerged" ||
          change.worktreeStatus === "unmerged",
      ),
    };

    this.repositoryStatusCache.set(normalizedRepositoryPath, {
      status,
      updatedAt: Date.now(),
    });

    return status;
  }

  stageFile(repositoryPath: string, filePath: string): GitRepositoryStatus {
    this.runCheckedGit(repositoryPath, ["add", "--", filePath], "stage file");
    return this.getRepositoryStatus(repositoryPath);
  }

  stageFiles(repositoryPath: string, filePaths: string[]): GitRepositoryStatus {
    if (filePaths.length === 0) {
      return this.getRepositoryStatus(repositoryPath);
    }

    this.runCheckedGit(
      repositoryPath,
      ["add", "--", ...filePaths],
      "stage files",
    );
    return this.getRepositoryStatus(repositoryPath);
  }

  unstageFile(repositoryPath: string, filePath: string): GitRepositoryStatus {
    this.runCheckedGit(
      repositoryPath,
      ["restore", "--staged", "--", filePath],
      "unstage file",
    );
    return this.getRepositoryStatus(repositoryPath);
  }

  unstageFiles(
    repositoryPath: string,
    filePaths: string[],
  ): GitRepositoryStatus {
    if (filePaths.length === 0) {
      return this.getRepositoryStatus(repositoryPath);
    }

    this.runCheckedGit(
      repositoryPath,
      ["restore", "--staged", "--", ...filePaths],
      "unstage files",
    );
    return this.getRepositoryStatus(repositoryPath);
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

    this.runCheckedGit(
      repositoryPath,
      ["restore", "--worktree", "--", filePath],
      "discard file changes",
    );
    return this.getRepositoryStatus(repositoryPath);
  }

  commit(repositoryPath: string, message: string): GitRepositoryStatus {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error("Commit message must not be empty");
    }

    this.runCheckedGit(
      repositoryPath,
      ["commit", "-m", trimmed],
      "commit changes",
    );
    return this.getRepositoryStatus(repositoryPath);
  }

  pull(repositoryPath: string): GitRepositoryStatus {
    this.runCheckedGit(repositoryPath, ["pull", "--ff-only"], "pull changes");
    return this.getRepositoryStatus(repositoryPath);
  }

  push(repositoryPath: string): GitRepositoryStatus {
    this.runCheckedGit(repositoryPath, ["push"], "push changes");
    return this.getRepositoryStatus(repositoryPath);
  }

  fetch(repositoryPath: string): GitRepositoryStatus {
    this.runCheckedGit(
      repositoryPath,
      ["fetch", "--all", "--prune"],
      "fetch changes",
    );
    return this.getRepositoryStatus(repositoryPath);
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
    const change = [...status.stagedChanges, ...status.unstagedChanges].find(
      (c) => c.path === filePath,
    );

    if (!change && result.stdout.trim() === "") {
      const isUntracked =
        status.unstagedChanges.some(
          (c) => c.path === filePath && c.status === "untracked",
        ) ||
        status.stagedChanges.some(
          (c) => c.path === filePath && c.status === "untracked",
        );

      if (isUntracked) {
        return this.diffUntrackedFile(repositoryPath, filePath);
      }

      return {
        filePath,
        oldFilePath: null,
        status: "modified" as GitFileChangeStatus,
        hunks: [],
        binary: false,
      };
    }

    const fileStatus = change?.status ?? "modified";
    const oldFilePath = change?.status === "renamed" ? filePath : null;

    if (result.stdout.includes("Binary files")) {
      return {
        filePath,
        oldFilePath,
        status: fileStatus,
        hunks: [],
        binary: true,
      };
    }

    const hunks = this.parseUnifiedDiff(result.stdout);
    return {
      filePath,
      oldFilePath,
      status: fileStatus,
      hunks,
      binary: false,
    };
  }

  private diffUntrackedFile(
    repositoryPath: string,
    filePath: string,
  ): GitFileDiff {
    const absolutePath = resolveInsideRepository(repositoryPath, filePath);

    let content: string;
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      return {
        filePath,
        oldFilePath: null,
        status: "untracked",
        hunks: [],
        binary: true,
      };
    }

    const lines = content.split(/\r?\n/);
    const diffLines: GitDiffLine[] = lines.map((line, i) => ({
      type: "add" as const,
      content: line,
      oldLineNumber: null,
      newLineNumber: i + 1,
    }));

    return {
      filePath,
      oldFilePath: null,
      status: "untracked",
      hunks:
        lines.length > 0
          ? [
              {
                oldStart: 0,
                oldCount: 0,
                newStart: 1,
                newCount: lines.length,
                lines: diffLines,
              },
            ]
          : [],
      binary: false,
    };
  }

  private parseUnifiedDiff(diffOutput: string): GitDiffHunk[] {
    const hunks: GitDiffHunk[] = [];
    const lines = diffOutput.split(/\r?\n/);

    let currentHunk: GitDiffHunk | null = null;
    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      const hunkMatch = line.match(
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
      );
      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          oldStart: Number(hunkMatch[1]),
          oldCount: Number(hunkMatch[2] ?? "1"),
          newStart: Number(hunkMatch[3]),
          newCount: Number(hunkMatch[4] ?? "1"),
          lines: [],
        };
        oldLine = Number(hunkMatch[1]);
        newLine = Number(hunkMatch[3]);
        continue;
      }

      if (
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("diff ")
      ) {
        continue;
      }

      if (!currentHunk) {
        continue;
      }

      if (line.startsWith("+")) {
        currentHunk.lines.push({
          type: "add",
          content: line.slice(1),
          oldLineNumber: null,
          newLineNumber: newLine++,
        });
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({
          type: "remove",
          content: line.slice(1),
          oldLineNumber: oldLine++,
          newLineNumber: null,
        });
      } else if (line.startsWith(" ")) {
        currentHunk.lines.push({
          type: "context",
          content: line.slice(1),
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
        });
      } else if (line.startsWith("\\ ")) {
        currentHunk.lines.push({
          type: "context",
          content: line.slice(2),
          oldLineNumber: null,
          newLineNumber: null,
        });
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  private inspectWorktree(
    entry: ParsedWorktree,
    currentWorktreeRoot: string,
    commonGitDir: string,
  ): GitWorktreeSummary {
    const branch = parseBranchName(entry.branchRef);
    const isDetached = entry.detached || branch === null;
    const commit = entry.head ? entry.head.slice(0, 7) : null;

    if (!fs.existsSync(entry.path)) {
      return {
        id: entry.path,
        path: entry.path,
        isMain: false,
        isCurrent: entry.path === currentWorktreeRoot,
        isDetached,
        isPrunable: entry.prunableReason !== null,
        prunableReason: entry.prunableReason,
        branch: isDetached ? null : branch,
        commit,
        git: {
          ...createMissingGitSummary(
            entry.prunableReason ?? "Worktree path missing",
          ),
          branch: isDetached ? null : branch,
          commit,
        },
      };
    }

    const absoluteGitDir = this.resolveAbsoluteGitDir(entry.path);
    const git = this.inspectWorktreeGit(entry.path, {
      branch: isDetached ? null : branch,
      commit,
      message: entry.prunableReason,
    });

    return {
      id: entry.path,
      path: entry.path,
      isMain: absoluteGitDir === commonGitDir,
      isCurrent: entry.path === currentWorktreeRoot,
      isDetached,
      isPrunable: entry.prunableReason !== null,
      prunableReason: entry.prunableReason,
      branch: git.branch,
      commit: git.commit,
      git,
    };
  }

  private inspectWorktreeGit(
    worktreePath: string,
    fallback: {
      branch: string | null;
      commit: string | null;
      message: string | null;
    },
  ): WorktreeGitSnapshot {
    const statusResult = this.runGit(worktreePath, [
      "status",
      "--porcelain=2",
      "--branch",
    ]);
    if (statusResult.error) {
      return createUnavailableGitSummary(statusResult.error.message);
    }
    if (statusResult.status !== 0) {
      return createUnavailableGitSummary(
        statusResult.stderr.trim() || "Failed to inspect worktree status",
      );
    }

    let branch = fallback.branch;
    let commit = fallback.commit;
    let ahead = 0;
    let behind = 0;

    for (const line of statusResult.stdout.split(/\r?\n/)) {
      if (line.startsWith("# branch.head ")) {
        const head = line.replace(/^# branch\.head\s+/, "").trim();
        branch = head === "(detached)" ? null : head;
        continue;
      }
      if (line.startsWith("# branch.oid ")) {
        const oid = line.replace(/^# branch\.oid\s+/, "").trim();
        if (oid && oid !== "(initial)") {
          commit = oid.slice(0, 7);
        }
        continue;
      }
      if (line.startsWith("# branch.ab ")) {
        const match = line.match(/^# branch\.ab \+(\d+) -(\d+)/);
        if (match) {
          ahead = Number(match[1]);
          behind = Number(match[2]);
        }
      }
    }

    let stagedCount = 0;
    let modifiedCount = 0;
    let untrackedCount = 0;
    const porcelainResult = this.runGit(worktreePath, [
      "status",
      "--porcelain",
    ]);
    if (porcelainResult.error) {
      return createUnavailableGitSummary(porcelainResult.error.message);
    }
    if (porcelainResult.status !== 0) {
      return createUnavailableGitSummary(
        porcelainResult.stderr.trim() || "Failed to inspect worktree changes",
      );
    }

    for (const line of porcelainResult.stdout.split(/\r?\n/)) {
      if (!line) {
        continue;
      }
      if (line.startsWith("??")) {
        untrackedCount++;
        continue;
      }

      const staged = line[0];
      const modified = line[1];
      if (staged && staged !== " ") {
        stagedCount++;
      }
      if (modified && modified !== " ") {
        modifiedCount++;
      }
    }

    return {
      status: "ready",
      branch,
      commit,
      hasChanges: stagedCount + modifiedCount + untrackedCount > 0,
      ahead,
      behind,
      stagedCount,
      modifiedCount,
      untrackedCount,
      message: fallback.message,
    };
  }

  private detectDefaultBranch(
    currentWorktreeRoot: string,
    fallbackBranch: string | null,
  ): string | null {
    const remotesResult = this.runGit(currentWorktreeRoot, ["remote"]);
    if (!remotesResult.error && remotesResult.status === 0) {
      const remotes = remotesResult.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const preferredRemote = remotes.includes("origin")
        ? "origin"
        : remotes[0];

      if (preferredRemote) {
        const symbolicRef = this.runGit(currentWorktreeRoot, [
          "symbolic-ref",
          "--quiet",
          `refs/remotes/${preferredRemote}/HEAD`,
        ]);
        if (
          !symbolicRef.error &&
          symbolicRef.status === 0 &&
          symbolicRef.stdout.trim()
        ) {
          return parseRemoteHeadBranch(symbolicRef.stdout.trim());
        }
      }
    }

    return fallbackBranch;
  }

  private resolveUpstreamBranch(worktreePath: string): string | null {
    const result = this.runGit(worktreePath, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ]);

    if (result.error || result.status !== 0) {
      return null;
    }

    const upstream = result.stdout.trim();
    return upstream || null;
  }

  private resolveCurrentWorktreeRoot(targetPath: string): string | null {
    const result = this.runGit(targetPath, ["rev-parse", "--show-toplevel"]);
    if (result.error) {
      return null;
    }
    if (result.status !== 0 || !result.stdout.trim()) {
      return null;
    }

    return normalizePathId(result.stdout.trim());
  }

  private resolveCommonGitDir(worktreeRoot: string): string | null {
    const result = this.runGit(worktreeRoot, ["rev-parse", "--git-common-dir"]);
    if (result.error || result.status !== 0 || !result.stdout.trim()) {
      return null;
    }

    const commonDir = result.stdout.trim();
    const absoluteCommonDir = path.isAbsolute(commonDir)
      ? commonDir
      : path.join(worktreeRoot, commonDir);

    return normalizePathId(absoluteCommonDir);
  }

  private resolveAbsoluteGitDir(worktreePath: string): string | null {
    const result = this.runGit(worktreePath, [
      "rev-parse",
      "--absolute-git-dir",
    ]);
    if (result.error || result.status !== 0 || !result.stdout.trim()) {
      return null;
    }

    return normalizePathId(result.stdout.trim());
  }

  private async resolveCurrentWorktreeRootAsync(
    targetPath: string,
  ): Promise<string | null> {
    const result = await this.runGitAsync(targetPath, [
      "rev-parse",
      "--show-toplevel",
    ]);
    if (result.error || result.status !== 0 || !result.stdout.trim())
      return null;
    return normalizePathId(result.stdout.trim());
  }

  private async resolveCommonGitDirAsync(
    worktreeRoot: string,
  ): Promise<string | null> {
    const result = await this.runGitAsync(worktreeRoot, [
      "rev-parse",
      "--git-common-dir",
    ]);
    if (result.error || result.status !== 0 || !result.stdout.trim())
      return null;
    const commonDir = result.stdout.trim();
    const absoluteCommonDir = path.isAbsolute(commonDir)
      ? commonDir
      : path.join(worktreeRoot, commonDir);
    return normalizePathId(absoluteCommonDir);
  }

  private async inspectWorktreeAsync(
    entry: ParsedWorktree,
    currentWorktreeRoot: string,
    commonGitDir: string,
  ): Promise<GitWorktreeSummary> {
    const branch = parseBranchName(entry.branchRef);
    const isDetached = entry.detached || branch === null;
    const commit = entry.head ? entry.head.slice(0, 7) : null;

    if (!fs.existsSync(entry.path)) {
      return {
        id: entry.path,
        path: entry.path,
        isMain: false,
        isCurrent: entry.path === currentWorktreeRoot,
        isDetached,
        isPrunable: entry.prunableReason !== null,
        prunableReason: entry.prunableReason,
        branch: isDetached ? null : branch,
        commit,
        git: {
          ...createMissingGitSummary(
            entry.prunableReason ?? "Worktree path missing",
          ),
          branch: isDetached ? null : branch,
          commit,
        },
      };
    }

    const absoluteGitDir = await this.resolveAbsoluteGitDirAsync(entry.path);
    const git = await this.inspectWorktreeGitAsync(entry.path, {
      branch: isDetached ? null : branch,
      commit,
      message: entry.prunableReason,
    });

    return {
      id: entry.path,
      path: entry.path,
      isMain: absoluteGitDir === commonGitDir,
      isCurrent: entry.path === currentWorktreeRoot,
      isDetached,
      isPrunable: entry.prunableReason !== null,
      prunableReason: entry.prunableReason,
      branch: git.branch,
      commit: git.commit,
      git,
    };
  }

  private async inspectWorktreeGitAsync(
    worktreePath: string,
    fallback: {
      branch: string | null;
      commit: string | null;
      message: string | null;
    },
  ): Promise<WorktreeGitSnapshot> {
    const statusResult = await this.runGitAsync(worktreePath, [
      "status",
      "--porcelain=2",
      "--branch",
    ]);
    if (statusResult.error)
      return createUnavailableGitSummary(statusResult.error.message);
    if (statusResult.status !== 0)
      return createUnavailableGitSummary(
        statusResult.stderr.trim() || "Failed to inspect worktree status",
      );

    let branch = fallback.branch;
    let commit = fallback.commit;
    let ahead = 0;
    let behind = 0;

    for (const line of statusResult.stdout.split(/\r?\n/)) {
      if (line.startsWith("# branch.head ")) {
        const head = line.replace(/^# branch\.head\s+/, "").trim();
        branch = head === "(detached)" ? null : head;
        continue;
      }
      if (line.startsWith("# branch.oid ")) {
        const oid = line.replace(/^# branch\.oid\s+/, "").trim();
        if (oid && oid !== "(initial)") commit = oid.slice(0, 7);
        continue;
      }
      if (line.startsWith("# branch.ab ")) {
        const match = line.match(/^# branch\.ab \+(\d+) -(\d+)/);
        if (match) {
          ahead = Number(match[1]);
          behind = Number(match[2]);
        }
      }
    }

    let stagedCount = 0;
    let modifiedCount = 0;
    let untrackedCount = 0;
    const porcelainResult = await this.runGitAsync(worktreePath, [
      "status",
      "--porcelain",
    ]);
    if (porcelainResult.error)
      return createUnavailableGitSummary(porcelainResult.error.message);
    if (porcelainResult.status !== 0)
      return createUnavailableGitSummary(
        porcelainResult.stderr.trim() || "Failed to inspect worktree changes",
      );

    for (const line of porcelainResult.stdout.split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith("??")) {
        untrackedCount++;
        continue;
      }
      const staged = line[0];
      const modified = line[1];
      if (staged && staged !== " ") stagedCount++;
      if (modified && modified !== " ") modifiedCount++;
    }

    return {
      status: "ready",
      branch,
      commit,
      hasChanges: stagedCount + modifiedCount + untrackedCount > 0,
      ahead,
      behind,
      stagedCount,
      modifiedCount,
      untrackedCount,
      message: fallback.message,
    };
  }

  private async resolveAbsoluteGitDirAsync(
    worktreePath: string,
  ): Promise<string | null> {
    const result = await this.runGitAsync(worktreePath, [
      "rev-parse",
      "--absolute-git-dir",
    ]);
    if (result.error || result.status !== 0 || !result.stdout.trim())
      return null;
    return normalizePathId(result.stdout.trim());
  }

  private async detectDefaultBranchAsync(
    currentWorktreeRoot: string,
    fallbackBranch: string | null,
  ): Promise<string | null> {
    const remotesResult = await this.runGitAsync(currentWorktreeRoot, [
      "remote",
    ]);
    if (!remotesResult.error && remotesResult.status === 0) {
      const remotes = remotesResult.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const preferredRemote = remotes.includes("origin")
        ? "origin"
        : remotes[0];
      if (preferredRemote) {
        const symbolicRef = await this.runGitAsync(currentWorktreeRoot, [
          "symbolic-ref",
          "--quiet",
          `refs/remotes/${preferredRemote}/HEAD`,
        ]);
        if (
          !symbolicRef.error &&
          symbolicRef.status === 0 &&
          symbolicRef.stdout.trim()
        ) {
          return parseRemoteHeadBranch(symbolicRef.stdout.trim());
        }
      }
    }
    return fallbackBranch;
  }

  private runGit(cwd: string, args: string[]): GitCommandResult {
    try {
      const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
      });

      return {
        status: result.status ?? 1,
        stdout: String(result.stdout ?? ""),
        stderr: String(result.stderr ?? ""),
        error: result.error ?? null,
      };
    } catch (error: unknown) {
      return {
        status: 1,
        stdout: "",
        stderr: "",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private async runGitAsync(
    cwd: string,
    args: string[],
  ): Promise<GitCommandResult> {
    try {
      const { stdout, stderr } = await execFileAsync("git", args, {
        cwd,
        encoding: "utf8",
      });
      return {
        status: 0,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
        error: null,
      };
    } catch (error: unknown) {
      if (error && typeof error === "object" && "status" in error) {
        const execError = error as {
          status?: number;
          stdout?: string;
          stderr?: string;
          message?: string;
        };
        return {
          status: execError.status ?? 1,
          stdout: String(execError.stdout ?? ""),
          stderr: String(execError.stderr ?? ""),
          error: null,
        };
      }
      return {
        status: 1,
        stdout: "",
        stderr: "",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private runCheckedGit(cwd: string, args: string[], label: string): void {
    const result = this.runGit(cwd, args);

    if (result.error || result.status !== 0) {
      throw new Error(
        result.error?.message || result.stderr.trim() || `Failed to ${label}`,
      );
    }

    this.clearCachesForPath(cwd);
  }

  private clearCachesForPath(targetPath: string): void {
    this.inspectionCache.delete(normalizePathId(targetPath));
    const now = Date.now();
    for (const [key, entry] of this.inspectionCache) {
      if (now - entry.updatedAt > GitWorktreeService.INSPECTION_CACHE_TTL * 2) {
        this.inspectionCache.delete(key);
      }
    }
    this.repositoryStatusCache.delete(normalizePathId(targetPath));
    for (const [key, entry] of this.repositoryStatusCache) {
      if (now - entry.updatedAt > GitWorktreeService.STATUS_CACHE_TTL * 2) {
        this.repositoryStatusCache.delete(key);
      }
    }
  }

  private clearCaches(): void {
    this.inspectionCache.clear();
    this.repositoryStatusCache.clear();
  }
}
