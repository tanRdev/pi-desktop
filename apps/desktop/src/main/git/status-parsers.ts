import type {
  GitFileChange,
  GitFileChangeStatus,
  WorktreeGitSnapshot,
} from "@pi-desktop/shared";
import { normalizePathId } from "./path-utils";

export type ParsedWorktree = {
  path: string;
  head: string | null;
  branchRef: string | null;
  detached: boolean;
  prunableReason: string | null;
};

export function parseBranchName(branchRef: string | null): string | null {
  if (!branchRef) {
    return null;
  }

  return branchRef.replace(/^refs\/heads\//, "");
}

export function parseRemoteHeadBranch(symbolicRef: string): string | null {
  const trimmed = symbolicRef.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split("/");
  return parts[parts.length - 1] ?? null;
}

export function createMissingGitSummary(
  reason: string | null,
): WorktreeGitSnapshot {
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

export function createUnavailableGitSummary(
  message: string,
): WorktreeGitSnapshot {
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

export function mapPorcelainStatus(code: string): GitFileChangeStatus {
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

export function parseGitFileChange(line: string): GitFileChange | null {
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

export function parseRenamedOldFilePathFromStatus(
  statusOutput: string,
  filePath: string,
): string | null {
  for (const line of statusOutput.split(/\r?\n/)) {
    if (!line.includes(" -> ")) {
      continue;
    }

    const trimmed = line.trim();
    const arrowIndex = trimmed.indexOf(" -> ");
    if (arrowIndex === -1) {
      continue;
    }

    const oldPath = trimmed.slice(3, arrowIndex).trim();
    const newPath = trimmed.slice(arrowIndex + 4).trim();
    if (newPath === filePath && oldPath) {
      return oldPath;
    }
  }

  return null;
}

export function parseWorktreeBlocks(output: string): ParsedWorktree[] {
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
