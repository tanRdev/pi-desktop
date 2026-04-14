import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  GitFileChange,
  GitFileChangeStatus,
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeGitSnapshot,
} from "@pi-desktop/shared";

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

export class GitWorktreeService {
  inspect(targetPath: string): GitRepositoryInspection {
    const commandCwd = resolveCommandCwd(targetPath);
    const currentWorktreeRoot = this.resolveCurrentWorktreeRoot(commandCwd);

    if (!currentWorktreeRoot) {
      return {
        status: "not_repo",
        message: null,
      };
    }

    const commonGitDir = this.resolveCommonGitDir(currentWorktreeRoot);
    if (!commonGitDir) {
      return {
        status: "unavailable",
        message: "Failed to resolve the common git directory",
      };
    }

    const worktreeList = this.runGit(currentWorktreeRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]);
    if (worktreeList.error) {
      return {
        status: "unavailable",
        message: worktreeList.error.message,
      };
    }
    if (worktreeList.status !== 0) {
      return {
        status: "unavailable",
        message: worktreeList.stderr.trim() || "Failed to list git worktrees",
      };
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

    return {
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
    const args =
      branchExists.status === 0
        ? ["worktree", "add", worktreePath, branchName]
        : options.baseBranch
          ? [
              "worktree",
              "add",
              "-b",
              branchName,
              worktreePath,
              options.baseBranch,
            ]
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

  getRepositoryStatus(repositoryPath: string): GitRepositoryStatus {
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

    return {
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
  }

  stageFile(repositoryPath: string, filePath: string): GitRepositoryStatus {
    this.runCheckedGit(repositoryPath, ["add", "--", filePath], "stage file");
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

  discardFile(repositoryPath: string, filePath: string): GitRepositoryStatus {
    const status = this.getRepositoryStatus(repositoryPath);
    const isUntracked = status.unstagedChanges.some(
      (change) => change.path === filePath && change.status === "untracked",
    );

    if (isUntracked) {
      const absolutePath = path.join(repositoryPath, filePath);
      fs.rmSync(absolutePath, { force: true, recursive: true });
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

  private runCheckedGit(cwd: string, args: string[], label: string): void {
    const result = this.runGit(cwd, args);

    if (result.error || result.status !== 0) {
      throw new Error(
        result.error?.message || result.stderr.trim() || `Failed to ${label}`,
      );
    }
  }
}
