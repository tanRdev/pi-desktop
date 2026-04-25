import type { GitRepositoryStatus } from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";

import { loadRepositoryStatus } from "./repository-status-loader";

function createWorktreeSummary(path: string, branch: string, commit: string) {
  return {
    id: path,
    path,
    isMain: true,
    isCurrent: true,
    isDetached: false,
    isPrunable: false,
    prunableReason: null,
    branch,
    commit,
    git: {
      status: "ready" as const,
      branch,
      commit,
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: null,
    },
  };
}

describe("loadRepositoryStatus", () => {
  it("throws the inspection message when the repository is unavailable", () => {
    expect(() =>
      loadRepositoryStatus({
        repositoryPath: "/repo",
        inspectRepository: () => ({
          status: "unavailable",
          message: "Git repository is unavailable",
        }),
        runGit: vi.fn(),
        resolveUpstreamBranch: vi.fn(),
      }),
    ).toThrowError("Git repository is unavailable");
  });

  it("throws when the active worktree summary is missing", () => {
    expect(() =>
      loadRepositoryStatus({
        repositoryPath: "/repo",
        inspectRepository: () => ({
          status: "repository",
          currentWorktreePath: "/repo",
          worktrees: [
            createWorktreeSummary(
              "/repo/worktrees/feature",
              "feature",
              "abcdef1",
            ),
          ],
          message: null,
        }),
        runGit: vi.fn(),
        resolveUpstreamBranch: vi.fn(),
      }),
    ).toThrowError("Active worktree status is unavailable");
  });

  it("loads repository status from porcelain output and the current worktree summary", () => {
    const expectedStatus: GitRepositoryStatus = {
      repositoryPath: "/repo",
      branch: "main",
      commit: "abcdef1",
      upstreamBranch: "origin/main",
      summary: {
        status: "ready",
        branch: "main",
        commit: "abcdef1",
        hasChanges: true,
        ahead: 1,
        behind: 0,
        stagedCount: 1,
        modifiedCount: 1,
        untrackedCount: 0,
        message: null,
      },
      stagedChanges: [],
      unstagedChanges: [],
      conflictedChanges: [],
    };
    const buildRepositoryStatus = vi.fn(() => expectedStatus);
    const runGit = vi.fn(() => ({
      status: 0,
      stdout: "M  src/index.ts\n",
      stderr: "",
      error: null,
    }));
    const resolveUpstreamBranch = vi.fn(() => "origin/main");

    const status = loadRepositoryStatus({
      repositoryPath: "/repo",
      inspectRepository: () => ({
        status: "repository",
        currentWorktreePath: "/repo",
        worktrees: [createWorktreeSummary("/repo", "main", "abcdef1")],
        message: null,
      }),
      runGit,
      resolveUpstreamBranch,
      buildRepositoryStatus,
    });

    expect(status).toBe(expectedStatus);
    expect(runGit).toHaveBeenCalledWith("/repo", ["status", "--porcelain"]);
    expect(resolveUpstreamBranch).toHaveBeenCalledWith(runGit, "/repo");
    expect(buildRepositoryStatus).toHaveBeenCalledWith({
      repositoryPath: "/repo",
      branch: "main",
      commit: "abcdef1",
      upstreamBranch: "origin/main",
      summary: createWorktreeSummary("/repo", "main", "abcdef1").git,
      porcelainOutput: "M  src/index.ts\n",
    });
  });
});
