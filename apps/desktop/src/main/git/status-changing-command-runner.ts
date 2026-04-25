import type { GitRepositoryStatus } from "@pi-desktop/shared";

import type { RunGit } from "./git-command-runner";
import { runCheckedGitStatusCommand } from "./git-command-status";
import type { buildCommitCommand } from "./status-changing-commands";

type StatusChangingCommand = ReturnType<typeof buildCommitCommand>;

type CreateStatusChangingCommandRunnerInput = {
  runGit: RunGit;
  clearCachesForPath: (targetPath: string) => void;
  getRepositoryStatus: (repositoryPath: string) => GitRepositoryStatus;
};

export function createStatusChangingCommandRunner(
  input: CreateStatusChangingCommandRunnerInput,
) {
  return function runStatusChangingCommand(
    repositoryPath: string,
    command: StatusChangingCommand,
  ): GitRepositoryStatus {
    return runCheckedGitStatusCommand({
      runGit: input.runGit,
      repositoryPath,
      args: command.args,
      label: command.label,
      clearCachesForPath: input.clearCachesForPath,
      getRepositoryStatus: input.getRepositoryStatus,
    });
  };
}
