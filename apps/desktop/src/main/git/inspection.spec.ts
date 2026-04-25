import { describe, expect, it } from "vitest";
import type { GitWorktreeSummary } from "../git-worktree-service";
import { buildRepositoryInspection } from "./inspection";

function createWorktree(
  overrides: Partial<GitWorktreeSummary> = {},
): GitWorktreeSummary {
  return {
    id: "/repo/main",
    path: "/repo/main",
    isMain: true,
    isCurrent: false,
    isDetached: false,
    isPrunable: false,
    prunableReason: null,
    branch: "main",
    commit: "abc1234",
    git: {
      status: "ready",
      branch: "main",
      commit: "abc1234",
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: null,
    },
    ...overrides,
  };
}

describe("buildRepositoryInspection", () => {
  it("uses the main worktree as the repository root", () => {
    const inspection = buildRepositoryInspection({
      currentWorktreeRoot: "/repo/feature",
      defaultBranch: "main",
      worktrees: [
        createWorktree(),
        createWorktree({
          id: "/repo/feature",
          path: "/repo/feature",
          isMain: false,
          isCurrent: true,
          branch: "feature/test",
          commit: "def5678",
          git: {
            status: "ready",
            branch: "feature/test",
            commit: "def5678",
            hasChanges: true,
            ahead: 2,
            behind: 1,
            stagedCount: 1,
            modifiedCount: 2,
            untrackedCount: 3,
            message: null,
          },
        }),
      ],
    });

    expect(inspection).toMatchObject({
      status: "repository",
      rootPath: "/repo/main",
      currentWorktreePath: "/repo/feature",
      defaultBranch: "main",
      message: null,
      currentGit: {
        status: "repository",
        rootPath: "/repo/main",
        branch: "feature/test",
        commit: "def5678",
        hasChanges: true,
        ahead: 2,
        behind: 1,
        stagedCount: 1,
        modifiedCount: 2,
        untrackedCount: 3,
        message: null,
      },
    });
  });

  it("reports detached current worktrees as HEAD", () => {
    const inspection = buildRepositoryInspection({
      currentWorktreeRoot: "/repo/detached",
      defaultBranch: "main",
      worktrees: [
        createWorktree(),
        createWorktree({
          id: "/repo/detached",
          path: "/repo/detached",
          isMain: false,
          isCurrent: true,
          isDetached: true,
          branch: null,
          commit: "fedcba9",
          git: {
            status: "ready",
            branch: null,
            commit: "fedcba9",
            hasChanges: false,
            ahead: 0,
            behind: 0,
            stagedCount: 0,
            modifiedCount: 0,
            untrackedCount: 0,
            message: "detached",
          },
        }),
      ],
    });

    expect(inspection.currentGit).toMatchObject({
      branch: "HEAD",
      commit: "fedcba9",
      message: "detached",
    });
  });
});
