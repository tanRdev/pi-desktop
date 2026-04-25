import { describe, expect, it } from "vitest";
import { buildRepositoryStatusFromPorcelain } from "./repository-status";

describe("repository status helper", () => {
  it("assembles staged, unstaged, and conflicted changes from porcelain output", () => {
    const status = buildRepositoryStatusFromPorcelain({
      repositoryPath: "/repo/worktree",
      branch: "feature/slice",
      commit: "1234567",
      upstreamBranch: "origin/feature/slice",
      summary: {
        status: "ready",
        branch: "feature/slice",
        commit: "1234567",
        hasChanges: true,
        ahead: 1,
        behind: 0,
        stagedCount: 2,
        modifiedCount: 2,
        untrackedCount: 1,
        message: null,
      },
      porcelainOutput: [
        "M  staged.txt",
        " M unstaged.txt",
        "MM both.txt",
        "UU conflicted.txt",
        "?? new-file.txt",
      ].join("\n"),
    });

    expect(status).toEqual({
      repositoryPath: "/repo/worktree",
      branch: "feature/slice",
      commit: "1234567",
      upstreamBranch: "origin/feature/slice",
      summary: {
        status: "ready",
        branch: "feature/slice",
        commit: "1234567",
        hasChanges: true,
        ahead: 1,
        behind: 0,
        stagedCount: 2,
        modifiedCount: 2,
        untrackedCount: 1,
        message: null,
      },
      stagedChanges: [
        {
          path: "staged.txt",
          status: "modified",
          indexStatus: "modified",
          worktreeStatus: null,
        },
        {
          path: "both.txt",
          status: "modified",
          indexStatus: "modified",
          worktreeStatus: "modified",
        },
        {
          path: "conflicted.txt",
          status: "unmerged",
          indexStatus: "unmerged",
          worktreeStatus: "unmerged",
        },
      ],
      unstagedChanges: [
        {
          path: "unstaged.txt",
          status: "modified",
          indexStatus: null,
          worktreeStatus: "modified",
        },
        {
          path: "both.txt",
          status: "modified",
          indexStatus: "modified",
          worktreeStatus: "modified",
        },
        {
          path: "new-file.txt",
          status: "untracked",
          indexStatus: null,
          worktreeStatus: "untracked",
        },
      ],
      conflictedChanges: [
        {
          path: "conflicted.txt",
          status: "unmerged",
          indexStatus: "unmerged",
          worktreeStatus: "unmerged",
        },
      ],
    });
  });
});
