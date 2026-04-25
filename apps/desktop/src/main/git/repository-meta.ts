import path from "node:path";
import type { RunGit, RunGitAsync } from "./git-command-runner";
import { normalizePathId } from "./path-utils";
import { parseRemoteHeadBranch } from "./status-parsers";

export function resolveCurrentWorktreeRoot(
  runGit: RunGit,
  targetPath: string,
): string | null {
  const result = runGit(targetPath, ["rev-parse", "--show-toplevel"]);
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  return normalizePathId(result.stdout.trim());
}

export function resolveCommonGitDir(
  runGit: RunGit,
  worktreeRoot: string,
): string | null {
  const result = runGit(worktreeRoot, ["rev-parse", "--git-common-dir"]);
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  const commonDir = result.stdout.trim();
  const absoluteCommonDir = path.isAbsolute(commonDir)
    ? commonDir
    : path.join(worktreeRoot, commonDir);

  return normalizePathId(absoluteCommonDir);
}

export function resolveAbsoluteGitDir(
  runGit: RunGit,
  worktreePath: string,
): string | null {
  const result = runGit(worktreePath, ["rev-parse", "--absolute-git-dir"]);
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  return normalizePathId(result.stdout.trim());
}

export function detectDefaultBranch(
  runGit: RunGit,
  currentWorktreeRoot: string,
  fallbackBranch: string | null,
): string | null {
  const remotesResult = runGit(currentWorktreeRoot, ["remote"]);
  if (!remotesResult.error && remotesResult.status === 0) {
    const remotes = remotesResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const preferredRemote = remotes.includes("origin") ? "origin" : remotes[0];

    if (preferredRemote) {
      const symbolicRef = runGit(currentWorktreeRoot, [
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

export function resolveUpstreamBranch(
  runGit: RunGit,
  worktreePath: string,
): string | null {
  const result = runGit(worktreePath, [
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

export async function resolveCurrentWorktreeRootAsync(
  runGitAsync: RunGitAsync,
  targetPath: string,
): Promise<string | null> {
  const result = await runGitAsync(targetPath, [
    "rev-parse",
    "--show-toplevel",
  ]);
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  return normalizePathId(result.stdout.trim());
}

export async function resolveCommonGitDirAsync(
  runGitAsync: RunGitAsync,
  worktreeRoot: string,
): Promise<string | null> {
  const result = await runGitAsync(worktreeRoot, [
    "rev-parse",
    "--git-common-dir",
  ]);
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  const commonDir = result.stdout.trim();
  const absoluteCommonDir = path.isAbsolute(commonDir)
    ? commonDir
    : path.join(worktreeRoot, commonDir);

  return normalizePathId(absoluteCommonDir);
}

export async function resolveAbsoluteGitDirAsync(
  runGitAsync: RunGitAsync,
  worktreePath: string,
): Promise<string | null> {
  const result = await runGitAsync(worktreePath, [
    "rev-parse",
    "--absolute-git-dir",
  ]);
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  return normalizePathId(result.stdout.trim());
}

export async function detectDefaultBranchAsync(
  runGitAsync: RunGitAsync,
  currentWorktreeRoot: string,
  fallbackBranch: string | null,
): Promise<string | null> {
  const remotesResult = await runGitAsync(currentWorktreeRoot, ["remote"]);
  if (!remotesResult.error && remotesResult.status === 0) {
    const remotes = remotesResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const preferredRemote = remotes.includes("origin") ? "origin" : remotes[0];

    if (preferredRemote) {
      const symbolicRef = await runGitAsync(currentWorktreeRoot, [
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
