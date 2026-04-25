import type { GitRepositoryStatus } from "@pi-desktop/shared";
import type { RunGit } from "./git-command-runner";

type RunCheckedGitCommandOptions = {
  runGit: RunGit;
  cwd: string;
  args: string[];
  label: string;
  clearCachesForPath: (targetPath: string) => void;
};

type RunCheckedGitStatusCommandOptions = {
  runGit: RunGit;
  repositoryPath: string;
  args: string[];
  label: string;
  clearCachesForPath: (targetPath: string) => void;
  getRepositoryStatus: (repositoryPath: string) => GitRepositoryStatus;
};

export function runCheckedGitCommand({
  runGit,
  cwd,
  args,
  label,
  clearCachesForPath,
}: RunCheckedGitCommandOptions): void {
  const result = runGit(cwd, args);

  if (result.error || result.status !== 0) {
    throw new Error(
      result.error?.message || result.stderr.trim() || `Failed to ${label}`,
    );
  }

  clearCachesForPath(cwd);
}

export function runCheckedGitStatusCommand({
  runGit,
  repositoryPath,
  args,
  label,
  clearCachesForPath,
  getRepositoryStatus,
}: RunCheckedGitStatusCommandOptions): GitRepositoryStatus {
  runCheckedGitCommand({
    runGit,
    cwd: repositoryPath,
    args,
    label,
    clearCachesForPath,
  });

  return getRepositoryStatus(repositoryPath);
}
