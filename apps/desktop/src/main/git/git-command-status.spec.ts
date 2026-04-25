import type { GitRepositoryStatus } from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";
import {
  runCheckedGitCommand,
  runCheckedGitStatusCommand,
} from "./git-command-status";

describe("git command status helpers", () => {
  it("returns the refreshed repository status after a successful command", () => {
    const runGit = vi.fn().mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "",
      error: null,
    });
    const clearCachesForPath = vi.fn();
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
    const getRepositoryStatus = vi.fn().mockReturnValue(expectedStatus);

    const status = runCheckedGitStatusCommand({
      runGit,
      repositoryPath: "/repo",
      args: ["fetch", "--all", "--prune"],
      label: "fetch changes",
      clearCachesForPath,
      getRepositoryStatus,
    });

    expect(status).toBe(expectedStatus);
    expect(runGit).toHaveBeenCalledWith("/repo", ["fetch", "--all", "--prune"]);
    expect(clearCachesForPath).toHaveBeenCalledWith("/repo");
    expect(getRepositoryStatus).toHaveBeenCalledWith("/repo");
  });

  it("does not clear caches when the git command fails", () => {
    const runGit = vi.fn().mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "permission denied\n",
      error: null,
    });
    const clearCachesForPath = vi.fn();

    expect(() =>
      runCheckedGitCommand({
        runGit,
        cwd: "/repo",
        args: ["commit", "-m", "msg"],
        label: "commit changes",
        clearCachesForPath,
      }),
    ).toThrowError("permission denied");

    expect(clearCachesForPath).not.toHaveBeenCalled();
  });
});
