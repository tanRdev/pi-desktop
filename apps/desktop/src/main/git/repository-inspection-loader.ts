import type {
  GitRepositoryInspection,
  GitWorktreeSummary,
} from "../git-worktree-service";
import type { GitCommandResult } from "./git-command-runner";
import {
  createNotRepositoryInspection,
  createUnavailableInspection,
} from "./inspection-outcomes";
import type { ParsedWorktree } from "./status-parsers";

type LoadRepositoryInspectionInput = {
  targetPath: string;
  resolveCommandCwd(targetPath: string): string;
  resolveCurrentWorktreeRoot(targetPath: string): string | null;
  resolveCommonGitDir(worktreeRoot: string): string | null;
  runWorktreeList(currentWorktreeRoot: string): GitCommandResult;
  parseWorktreeList(output: string): ParsedWorktree[];
  inspectWorktree(
    entry: ParsedWorktree,
    currentWorktreeRoot: string,
    commonGitDir: string,
  ): GitWorktreeSummary;
  detectDefaultBranch(
    currentWorktreeRoot: string,
    fallbackBranch: string | null,
  ): string | null;
  buildInspection(options: {
    currentWorktreeRoot: string;
    defaultBranch: string | null;
    worktrees: GitWorktreeSummary[];
  }): GitRepositoryInspection;
};

type LoadRepositoryInspectionAsyncInput = {
  targetPath: string;
  resolveCommandCwd(targetPath: string): string;
  resolveCurrentWorktreeRoot(targetPath: string): Promise<string | null>;
  resolveCommonGitDir(worktreeRoot: string): Promise<string | null>;
  runWorktreeList(currentWorktreeRoot: string): Promise<GitCommandResult>;
  parseWorktreeList(output: string): ParsedWorktree[];
  inspectWorktree(
    entry: ParsedWorktree,
    currentWorktreeRoot: string,
    commonGitDir: string,
  ): Promise<GitWorktreeSummary>;
  detectDefaultBranch(
    currentWorktreeRoot: string,
    fallbackBranch: string | null,
  ): Promise<string | null>;
  buildInspection(options: {
    currentWorktreeRoot: string;
    defaultBranch: string | null;
    worktrees: GitWorktreeSummary[];
  }): GitRepositoryInspection;
};

function sortWorktrees(worktrees: GitWorktreeSummary[]): GitWorktreeSummary[] {
  return [...worktrees].sort((left, right) => {
    if (left.isMain !== right.isMain) {
      return left.isMain ? -1 : 1;
    }

    return left.path.localeCompare(right.path);
  });
}

function createUnavailableFromWorktreeList(
  worktreeList: GitCommandResult,
): GitRepositoryInspection {
  if (worktreeList.error) {
    return createUnavailableInspection(worktreeList.error.message);
  }

  if (worktreeList.status !== 0) {
    return createUnavailableInspection(
      worktreeList.stderr.trim() || "Failed to list git worktrees",
    );
  }

  throw new Error("Expected a failing git worktree list result");
}

export function loadRepositoryInspection(
  input: LoadRepositoryInspectionInput,
): GitRepositoryInspection {
  const commandCwd = input.resolveCommandCwd(input.targetPath);
  const currentWorktreeRoot = input.resolveCurrentWorktreeRoot(commandCwd);

  if (!currentWorktreeRoot) {
    return createNotRepositoryInspection();
  }

  const commonGitDir = input.resolveCommonGitDir(currentWorktreeRoot);
  if (!commonGitDir) {
    return createUnavailableInspection(
      "Failed to resolve the common git directory",
    );
  }

  const worktreeList = input.runWorktreeList(currentWorktreeRoot);
  if (worktreeList.error || worktreeList.status !== 0) {
    return createUnavailableFromWorktreeList(worktreeList);
  }

  const parsedWorktrees = input.parseWorktreeList(worktreeList.stdout);
  const worktrees = sortWorktrees(
    parsedWorktrees.map((entry) =>
      input.inspectWorktree(entry, currentWorktreeRoot, commonGitDir),
    ),
  );
  const defaultBranch = input.detectDefaultBranch(
    currentWorktreeRoot,
    worktrees.find((worktree) => worktree.isMain)?.branch ?? null,
  );

  return input.buildInspection({
    currentWorktreeRoot,
    defaultBranch,
    worktrees,
  });
}

export async function loadRepositoryInspectionAsync(
  input: LoadRepositoryInspectionAsyncInput,
): Promise<GitRepositoryInspection> {
  const commandCwd = input.resolveCommandCwd(input.targetPath);
  const currentWorktreeRoot =
    await input.resolveCurrentWorktreeRoot(commandCwd);

  if (!currentWorktreeRoot) {
    return createNotRepositoryInspection();
  }

  const commonGitDir = await input.resolveCommonGitDir(currentWorktreeRoot);
  if (!commonGitDir) {
    return createUnavailableInspection(
      "Failed to resolve the common git directory",
    );
  }

  const worktreeList = await input.runWorktreeList(currentWorktreeRoot);
  if (worktreeList.error || worktreeList.status !== 0) {
    return createUnavailableFromWorktreeList(worktreeList);
  }

  const parsedWorktrees = input.parseWorktreeList(worktreeList.stdout);
  const worktrees = sortWorktrees(
    await Promise.all(
      parsedWorktrees.map((entry) =>
        input.inspectWorktree(entry, currentWorktreeRoot, commonGitDir),
      ),
    ),
  );
  const defaultBranch = await input.detectDefaultBranch(
    currentWorktreeRoot,
    worktrees.find((worktree) => worktree.isMain)?.branch ?? null,
  );

  return input.buildInspection({
    currentWorktreeRoot,
    defaultBranch,
    worktrees,
  });
}
