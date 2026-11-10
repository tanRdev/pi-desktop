import type { RunGit } from "./git-command-runner";
import { normalizePathId } from "./path-utils";
import {
  type ParsedWorktree,
  parseBranchName,
  parseWorktreeBlocks,
} from "./status-parsers";
import { buildCreateWorktreeCommand } from "./worktree-creation";

/**
 * Staged worktree setup (issue #12).
 *
 * Creation runs as an explicit sequence of stages so callers can show
 * real progress and, on failure, know exactly where setup stopped.
 * Two guarantees hold across stages:
 *
 * - Keep the checkout: a failed stage never deletes a worktree that
 *   git created (or that already existed). Partial progress stays on
 *   disk so the user can inspect or repair it.
 * - Retry is idempotent: if the target path is already a registered
 *   worktree for the requested branch, setup reuses it and returns
 *   success instead of asking git to create a duplicate.
 *
 * The `ready` stage means the checkout itself is ready; controllers
 * may follow it with their own `open-worktree` stage when they open
 * the checkout (thread creation, runtime attach, ...).
 */

export type WorktreeSetupStageId =
  | "validate"
  | "prepare-directory"
  | "resolve-branch"
  | "create-worktree"
  | "open-worktree"
  | "ready";

export type WorktreeSetupStageStatus = "started" | "completed" | "failed";

export interface WorktreeSetupStageEvent {
  stage: WorktreeSetupStageId;
  status: WorktreeSetupStageStatus;
  message?: string;
}

export type WorktreeSetupStageReporter = (
  event: WorktreeSetupStageEvent,
) => void;

export interface CreateWorktreeWithStagesOptions {
  repositoryRoot: string;
  branchName: string;
  worktreePath: string;
  baseBranch?: string;
  onStage?: WorktreeSetupStageReporter;
}

export interface WorktreeSetupDependencies {
  runGit: RunGit;
  /** Create the worktree's parent directory (recursive). */
  ensureParentDirectory(worktreePath: string): void;
  /** Normalize a filesystem path the same way the git layer does. */
  normalizePath(worktreePath: string): string;
}

export function findRegisteredWorktree(
  worktrees: ParsedWorktree[],
  worktreePath: string,
): ParsedWorktree | undefined {
  const target = normalizePathId(worktreePath);
  return worktrees.find(
    (worktree) => normalizePathId(worktree.path) === target,
  );
}

export function listRegisteredWorktrees(
  runGit: RunGit,
  repositoryRoot: string,
): ParsedWorktree[] {
  const result = runGit(repositoryRoot, ["worktree", "list", "--porcelain"]);
  if (result.error || result.status !== 0) {
    return [];
  }
  return parseWorktreeBlocks(result.stdout);
}

export function runCreateWorktreeWithStages(
  deps: WorktreeSetupDependencies,
  options: CreateWorktreeWithStagesOptions,
): string {
  const report = (event: WorktreeSetupStageEvent) => {
    try {
      options.onStage?.(event);
    } catch {
      // A broken progress reporter must never fail the setup itself.
    }
  };

  let stage: WorktreeSetupStageId = "validate";
  try {
    report({ stage, status: "started" });
    const repositoryRoot = deps.normalizePath(options.repositoryRoot);
    const worktreePath = options.worktreePath;
    const branchName = options.branchName.trim();
    if (!branchName) {
      throw new Error("Worktree branch name must not be empty");
    }
    report({ stage, status: "completed" });

    stage = "prepare-directory";
    report({ stage, status: "started" });
    deps.ensureParentDirectory(worktreePath);
    report({ stage, status: "completed" });

    stage = "create-worktree";
    const existing = findRegisteredWorktree(
      listRegisteredWorktrees(deps.runGit, repositoryRoot),
      worktreePath,
    );
    if (existing) {
      report({ stage, status: "started" });
      const existingBranch = parseBranchName(existing.branchRef);
      if (existingBranch !== branchName) {
        throw new Error(
          existingBranch
            ? `Worktree path is already registered for branch ${existingBranch}`
            : "Worktree path is already registered for a detached HEAD",
        );
      }
      report({
        stage,
        status: "completed",
        message: "Existing worktree reused",
      });
      report({ stage: "ready", status: "completed" });
      return deps.normalizePath(worktreePath);
    }

    stage = "resolve-branch";
    report({ stage, status: "started" });
    const args = buildCreateWorktreeCommand(deps.runGit, {
      repositoryRoot,
      branchName,
      worktreePath,
      baseBranch: options.baseBranch,
    });
    report({ stage, status: "completed" });

    stage = "create-worktree";
    report({ stage, status: "started" });
    const result = deps.runGit(repositoryRoot, args);
    if (result.error || result.status !== 0) {
      // Deliberately no cleanup: git may have partially created the
      // checkout, and keeping it lets a retry reuse or repair it.
      throw new Error(
        result.error?.message ||
          result.stderr.trim() ||
          `Failed to create worktree for branch ${branchName}`,
      );
    }
    report({ stage, status: "completed" });

    report({ stage: "ready", status: "completed" });
    return deps.normalizePath(worktreePath);
  } catch (error) {
    report({
      stage,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
