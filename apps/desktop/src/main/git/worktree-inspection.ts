import type { WorktreeGitSnapshot } from "@pi-desktop/shared";

import type { GitWorktreeSummary } from "../git-worktree-service";
import {
  createMissingGitSummary,
  type ParsedWorktree,
  parseBranchName,
} from "./status-parsers";

type WorktreeInspectionFallback = {
  branch: string | null;
  commit: string | null;
  message: string | null;
};

type InspectParsedWorktreeInput = {
  entry: ParsedWorktree;
  currentWorktreeRoot: string;
  commonGitDir: string;
  existsSync(targetPath: string): boolean;
  resolveAbsoluteGitDir(worktreePath: string): string | null;
  inspectWorktreeGit(
    worktreePath: string,
    fallback: WorktreeInspectionFallback,
  ): WorktreeGitSnapshot;
};

type InspectParsedWorktreeAsyncInput = {
  entry: ParsedWorktree;
  currentWorktreeRoot: string;
  commonGitDir: string;
  existsSync(targetPath: string): boolean;
  resolveAbsoluteGitDirAsync(worktreePath: string): Promise<string | null>;
  inspectWorktreeGitAsync(
    worktreePath: string,
    fallback: WorktreeInspectionFallback,
  ): Promise<WorktreeGitSnapshot>;
};

function buildWorktreeMetadata(
  entry: ParsedWorktree,
  currentWorktreeRoot: string,
) {
  const branch = parseBranchName(entry.branchRef);
  const isDetached = entry.detached || branch === null;
  const commit = entry.head ? entry.head.slice(0, 7) : null;

  return {
    branch,
    isDetached,
    commit,
    isCurrent: entry.path === currentWorktreeRoot,
  };
}

function createMissingWorktreeSummary(options: {
  entry: ParsedWorktree;
  currentWorktreeRoot: string;
}): GitWorktreeSummary {
  const metadata = buildWorktreeMetadata(
    options.entry,
    options.currentWorktreeRoot,
  );

  return {
    id: options.entry.path,
    path: options.entry.path,
    isMain: false,
    isCurrent: metadata.isCurrent,
    isDetached: metadata.isDetached,
    isPrunable: options.entry.prunableReason !== null,
    prunableReason: options.entry.prunableReason,
    branch: metadata.isDetached ? null : metadata.branch,
    commit: metadata.commit,
    git: {
      ...createMissingGitSummary(
        options.entry.prunableReason ?? "Worktree path missing",
      ),
      branch: metadata.isDetached ? null : metadata.branch,
      commit: metadata.commit,
    },
  };
}

function createWorktreeSummary(options: {
  entry: ParsedWorktree;
  currentWorktreeRoot: string;
  commonGitDir: string;
  absoluteGitDir: string | null;
  git: WorktreeGitSnapshot;
}): GitWorktreeSummary {
  const metadata = buildWorktreeMetadata(
    options.entry,
    options.currentWorktreeRoot,
  );

  return {
    id: options.entry.path,
    path: options.entry.path,
    isMain: options.absoluteGitDir === options.commonGitDir,
    isCurrent: metadata.isCurrent,
    isDetached: metadata.isDetached,
    isPrunable: options.entry.prunableReason !== null,
    prunableReason: options.entry.prunableReason,
    branch: options.git.branch,
    commit: options.git.commit,
    git: options.git,
  };
}

export function inspectParsedWorktree(
  input: InspectParsedWorktreeInput,
): GitWorktreeSummary {
  if (!input.existsSync(input.entry.path)) {
    return createMissingWorktreeSummary({
      entry: input.entry,
      currentWorktreeRoot: input.currentWorktreeRoot,
    });
  }

  const metadata = buildWorktreeMetadata(
    input.entry,
    input.currentWorktreeRoot,
  );
  const absoluteGitDir = input.resolveAbsoluteGitDir(input.entry.path);
  const git = input.inspectWorktreeGit(input.entry.path, {
    branch: metadata.isDetached ? null : metadata.branch,
    commit: metadata.commit,
    message: input.entry.prunableReason,
  });

  return createWorktreeSummary({
    entry: input.entry,
    currentWorktreeRoot: input.currentWorktreeRoot,
    commonGitDir: input.commonGitDir,
    absoluteGitDir,
    git,
  });
}

export async function inspectParsedWorktreeAsync(
  input: InspectParsedWorktreeAsyncInput,
): Promise<GitWorktreeSummary> {
  if (!input.existsSync(input.entry.path)) {
    return createMissingWorktreeSummary({
      entry: input.entry,
      currentWorktreeRoot: input.currentWorktreeRoot,
    });
  }

  const metadata = buildWorktreeMetadata(
    input.entry,
    input.currentWorktreeRoot,
  );
  const absoluteGitDir = await input.resolveAbsoluteGitDirAsync(
    input.entry.path,
  );
  const git = await input.inspectWorktreeGitAsync(input.entry.path, {
    branch: metadata.isDetached ? null : metadata.branch,
    commit: metadata.commit,
    message: input.entry.prunableReason,
  });

  return createWorktreeSummary({
    entry: input.entry,
    currentWorktreeRoot: input.currentWorktreeRoot,
    commonGitDir: input.commonGitDir,
    absoluteGitDir,
    git,
  });
}
