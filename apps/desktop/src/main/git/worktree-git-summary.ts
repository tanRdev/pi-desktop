import type { WorktreeGitSnapshot } from "@pi-desktop/shared";
import type { GitCommandResult } from "./git-command-runner";
import { createUnavailableGitSummary } from "./status-parsers";

type WorktreeGitSummaryFallback = {
  branch: string | null;
  commit: string | null;
  message: string | null;
};

type WorktreeGitBranchState = {
  branch: string | null;
  commit: string | null;
  ahead: number;
  behind: number;
};

type WorktreeGitChangeCounts = {
  stagedCount: number;
  modifiedCount: number;
  untrackedCount: number;
};

export function inspectWorktreeGitSummary(
  runGit: (cwd: string, args: string[]) => GitCommandResult,
  worktreePath: string,
  fallback: WorktreeGitSummaryFallback,
): WorktreeGitSnapshot {
  const branchStateResult = parseWorktreeBranchState(
    runGit(worktreePath, ["status", "--porcelain=2", "--branch"]),
    fallback,
  );
  if (branchStateResult.status === "unavailable") {
    return branchStateResult.summary;
  }

  const changeCountsResult = parseWorktreeChangeCounts(
    runGit(worktreePath, ["status", "--porcelain"]),
  );
  if (changeCountsResult.status === "unavailable") {
    return changeCountsResult.summary;
  }

  const { branch, commit, ahead, behind } = branchStateResult.branchState;
  const { stagedCount, modifiedCount, untrackedCount } =
    changeCountsResult.changeCounts;

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

export async function inspectWorktreeGitSummaryAsync(
  runGit: (cwd: string, args: string[]) => Promise<GitCommandResult>,
  worktreePath: string,
  fallback: WorktreeGitSummaryFallback,
): Promise<WorktreeGitSnapshot> {
  const branchStateResult = parseWorktreeBranchState(
    await runGit(worktreePath, ["status", "--porcelain=2", "--branch"]),
    fallback,
  );
  if (branchStateResult.status === "unavailable") {
    return branchStateResult.summary;
  }

  const changeCountsResult = parseWorktreeChangeCounts(
    await runGit(worktreePath, ["status", "--porcelain"]),
  );
  if (changeCountsResult.status === "unavailable") {
    return changeCountsResult.summary;
  }

  const { branch, commit, ahead, behind } = branchStateResult.branchState;
  const { stagedCount, modifiedCount, untrackedCount } =
    changeCountsResult.changeCounts;

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

function parseWorktreeBranchState(
  result: GitCommandResult,
  fallback: WorktreeGitSummaryFallback,
):
  | { status: "ok"; branchState: WorktreeGitBranchState }
  | { status: "unavailable"; summary: WorktreeGitSnapshot } {
  if (result.error) {
    return {
      status: "unavailable",
      summary: createUnavailableGitSummary(result.error.message),
    };
  }

  if (result.status !== 0) {
    return {
      status: "unavailable",
      summary: createUnavailableGitSummary(
        result.stderr.trim() || "Failed to inspect worktree status",
      ),
    };
  }

  let branch = fallback.branch;
  let commit = fallback.commit;
  let ahead = 0;
  let behind = 0;

  for (const line of result.stdout.split(/\r?\n/)) {
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

  return {
    status: "ok",
    branchState: {
      branch,
      commit,
      ahead,
      behind,
    },
  };
}

function parseWorktreeChangeCounts(
  result: GitCommandResult,
):
  | { status: "ok"; changeCounts: WorktreeGitChangeCounts }
  | { status: "unavailable"; summary: WorktreeGitSnapshot } {
  if (result.error) {
    return {
      status: "unavailable",
      summary: createUnavailableGitSummary(result.error.message),
    };
  }

  if (result.status !== 0) {
    return {
      status: "unavailable",
      summary: createUnavailableGitSummary(
        result.stderr.trim() || "Failed to inspect worktree changes",
      ),
    };
  }

  let stagedCount = 0;
  let modifiedCount = 0;
  let untrackedCount = 0;

  for (const line of result.stdout.split(/\r?\n/)) {
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
    status: "ok",
    changeCounts: {
      stagedCount,
      modifiedCount,
      untrackedCount,
    },
  };
}
