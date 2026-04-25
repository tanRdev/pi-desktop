import fs from "node:fs";
import type {
  GitDiffLine,
  GitFileChange,
  GitFileDiff,
  GitRepositoryStatus,
} from "@pi-desktop/shared";
import { parseUnifiedDiff } from "./diff-parsers";
import type { GitCommandResult, RunGit } from "./git-command-runner";
import { resolveInsideRepository } from "./path-utils";
import { parseRenamedOldFilePathFromStatus } from "./status-parsers";

export function resolveRenamedOldFilePath(
  runGit: RunGit,
  repositoryPath: string,
  filePath: string,
): string | null {
  const statusResult = runGit(repositoryPath, ["status", "--porcelain"]);
  if (statusResult.error || statusResult.status !== 0) {
    return null;
  }

  return parseRenamedOldFilePathFromStatus(statusResult.stdout, filePath);
}

export function buildUntrackedFileDiff(
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
    type: "add",
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

export function buildFileDiff(input: {
  runGit: RunGit;
  repositoryPath: string;
  filePath: string;
  status: GitRepositoryStatus;
  result: GitCommandResult;
}): GitFileDiff {
  const change = findFileChange(input.status, input.filePath);

  if (!change && input.result.stdout.trim() === "") {
    if (isUntrackedFile(input.status, input.filePath)) {
      return buildUntrackedFileDiff(input.repositoryPath, input.filePath);
    }

    return {
      filePath: input.filePath,
      oldFilePath: null,
      status: "modified",
      hunks: [],
      binary: false,
    };
  }

  const fileStatus = change?.status ?? "modified";
  const oldFilePath =
    change?.status === "renamed"
      ? resolveRenamedOldFilePath(
          input.runGit,
          input.repositoryPath,
          input.filePath,
        )
      : null;

  if (input.result.stdout.includes("Binary files")) {
    return {
      filePath: input.filePath,
      oldFilePath,
      status: fileStatus,
      hunks: [],
      binary: true,
    };
  }

  return {
    filePath: input.filePath,
    oldFilePath,
    status: fileStatus,
    hunks: parseUnifiedDiff(input.result.stdout),
    binary: false,
  };
}

function findFileChange(
  status: GitRepositoryStatus,
  filePath: string,
): GitFileChange | undefined {
  return [...status.stagedChanges, ...status.unstagedChanges].find(
    (change) => change.path === filePath,
  );
}

function isUntrackedFile(
  status: GitRepositoryStatus,
  filePath: string,
): boolean {
  return [...status.stagedChanges, ...status.unstagedChanges].some(
    (change) => change.path === filePath && change.status === "untracked",
  );
}
