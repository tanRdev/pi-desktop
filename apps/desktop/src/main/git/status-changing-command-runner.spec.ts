import type { GitRepositoryStatus } from "@pi-desktop/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runCheckedGitStatusCommand } = vi.hoisted(() => ({
  runCheckedGitStatusCommand: vi.fn(),
}));

vi.mock("./git-command-status", () => ({
  runCheckedGitStatusCommand,
}));

import { createStatusChangingCommandRunner } from "./status-changing-command-runner";

describe("status-changing-command-runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates status-changing commands through the checked status helper", () => {
    const expectedStatus: GitRepositoryStatus = {
      repositoryPath: "/repo",
      branch: "main",
      commit: "1234567",
      upstreamBranch: null,
      summary: {
        status: "ready",
        branch: "main",
        commit: "1234567",
        hasChanges: false,
        ahead: 0,
        behind: 0,
        stagedCount: 0,
        modifiedCount: 0,
        untrackedCount: 0,
        message: null,
      },
      stagedChanges: [],
      unstagedChanges: [],
      conflictedChanges: [],
    };
    const runGit = vi.fn();
    const clearCachesForPath = vi.fn();
    const getRepositoryStatus = vi.fn();
    const runStatusChangingCommand = createStatusChangingCommandRunner({
      runGit,
      clearCachesForPath,
      getRepositoryStatus,
    });

    runCheckedGitStatusCommand.mockReturnValue(expectedStatus);

    const status = runStatusChangingCommand("/repo", {
      args: ["fetch", "--all", "--prune"],
      label: "fetch changes",
    });

    expect(status).toBe(expectedStatus);
    expect(runCheckedGitStatusCommand).toHaveBeenCalledWith({
      runGit,
      repositoryPath: "/repo",
      args: ["fetch", "--all", "--prune"],
      label: "fetch changes",
      clearCachesForPath,
      getRepositoryStatus,
    });
  });
});
