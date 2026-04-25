type StatusChangingCommand = {
  args: string[];
  label: string;
};

export function buildStageFileCommand(filePath: string): StatusChangingCommand {
  return {
    args: ["add", "--", filePath],
    label: "stage file",
  };
}

export function buildStageFilesCommand(
  filePaths: string[],
): StatusChangingCommand {
  return {
    args: ["add", "--", ...filePaths],
    label: "stage files",
  };
}

export function buildUnstageFileCommand(
  filePath: string,
): StatusChangingCommand {
  return {
    args: ["restore", "--staged", "--", filePath],
    label: "unstage file",
  };
}

export function buildUnstageFilesCommand(
  filePaths: string[],
): StatusChangingCommand {
  return {
    args: ["restore", "--staged", "--", ...filePaths],
    label: "unstage files",
  };
}

export function buildDiscardTrackedFileCommand(
  filePath: string,
): StatusChangingCommand {
  return {
    args: ["restore", "--worktree", "--", filePath],
    label: "discard file changes",
  };
}

export function buildCommitCommand(message: string): StatusChangingCommand {
  return {
    args: ["commit", "-m", message],
    label: "commit changes",
  };
}

export function buildPullCommand(): StatusChangingCommand {
  return {
    args: ["pull", "--ff-only"],
    label: "pull changes",
  };
}

export function buildPushCommand(): StatusChangingCommand {
  return {
    args: ["push"],
    label: "push changes",
  };
}

export function buildFetchCommand(): StatusChangingCommand {
  return {
    args: ["fetch", "--all", "--prune"],
    label: "fetch changes",
  };
}
