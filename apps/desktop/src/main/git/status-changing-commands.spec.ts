import { describe, expect, it } from "vitest";

import {
  buildCommitCommand,
  buildDiscardTrackedFileCommand,
  buildFetchCommand,
  buildPullCommand,
  buildPushCommand,
  buildStageFileCommand,
  buildStageFilesCommand,
  buildUnstageFileCommand,
  buildUnstageFilesCommand,
} from "./status-changing-commands";

describe("status-changing-commands", () => {
  it("builds stage commands for one or many paths", () => {
    expect(buildStageFileCommand("src/index.ts")).toEqual({
      args: ["add", "--", "src/index.ts"],
      label: "stage file",
    });

    expect(buildStageFilesCommand(["src/index.ts", "README.md"])).toEqual({
      args: ["add", "--", "src/index.ts", "README.md"],
      label: "stage files",
    });
  });

  it("builds unstage and discard commands", () => {
    expect(buildUnstageFileCommand("src/index.ts")).toEqual({
      args: ["restore", "--staged", "--", "src/index.ts"],
      label: "unstage file",
    });

    expect(buildUnstageFilesCommand(["src/index.ts", "README.md"])).toEqual({
      args: ["restore", "--staged", "--", "src/index.ts", "README.md"],
      label: "unstage files",
    });

    expect(buildDiscardTrackedFileCommand("src/index.ts")).toEqual({
      args: ["restore", "--worktree", "--", "src/index.ts"],
      label: "discard file changes",
    });
  });

  it("builds commit, pull, push, and fetch commands", () => {
    expect(buildCommitCommand("message")).toEqual({
      args: ["commit", "-m", "message"],
      label: "commit changes",
    });
    expect(buildPullCommand()).toEqual({
      args: ["pull", "--ff-only"],
      label: "pull changes",
    });
    expect(buildPushCommand()).toEqual({
      args: ["push"],
      label: "push changes",
    });
    expect(buildFetchCommand()).toEqual({
      args: ["fetch", "--all", "--prune"],
      label: "fetch changes",
    });
  });
});
