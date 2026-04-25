import { describe, expect, it, vi } from "vitest";

import type { ParsedWorktree } from "./status-parsers";
import {
  inspectParsedWorktree,
  inspectParsedWorktreeAsync,
} from "./worktree-inspection";

function createParsedWorktree(
  overrides: Partial<ParsedWorktree> = {},
): ParsedWorktree {
  return {
    path: "/repo/worktrees/feature",
    head: "abcdef1234567890",
    branchRef: "refs/heads/feature/test",
    detached: false,
    prunableReason: null,
    ...overrides,
  };
}

describe("worktree inspection helpers", () => {
  it("creates a missing worktree summary when the worktree path is absent", () => {
    const existsSync = vi.fn(() => false);
    const resolveAbsoluteGitDir = vi.fn();
    const inspectWorktreeGit = vi.fn();

    const summary = inspectParsedWorktree({
      entry: createParsedWorktree({
        path: "/repo/worktrees/missing",
        prunableReason: "gone",
      }),
      currentWorktreeRoot: "/repo/main",
      commonGitDir: "/repo/.git",
      existsSync,
      resolveAbsoluteGitDir,
      inspectWorktreeGit,
    });

    expect(summary).toEqual({
      id: "/repo/worktrees/missing",
      path: "/repo/worktrees/missing",
      isMain: false,
      isCurrent: false,
      isDetached: false,
      isPrunable: true,
      prunableReason: "gone",
      branch: "feature/test",
      commit: "abcdef1",
      git: {
        status: "missing",
        branch: "feature/test",
        commit: "abcdef1",
        hasChanges: false,
        ahead: 0,
        behind: 0,
        stagedCount: 0,
        modifiedCount: 0,
        untrackedCount: 0,
        message: "gone",
      },
    });
    expect(resolveAbsoluteGitDir).not.toHaveBeenCalled();
    expect(inspectWorktreeGit).not.toHaveBeenCalled();
  });

  it("marks the main worktree using the resolved absolute git dir", () => {
    const resolveAbsoluteGitDir = vi.fn(() => "/repo/.git");
    const inspectWorktreeGit = vi.fn(() => ({
      status: "ready" as const,
      branch: "feature/test",
      commit: "abcdef1",
      hasChanges: true,
      ahead: 2,
      behind: 1,
      stagedCount: 1,
      modifiedCount: 2,
      untrackedCount: 3,
      message: null,
    }));

    const summary = inspectParsedWorktree({
      entry: createParsedWorktree({ path: "/repo/main" }),
      currentWorktreeRoot: "/repo/main",
      commonGitDir: "/repo/.git",
      existsSync: vi.fn(() => true),
      resolveAbsoluteGitDir,
      inspectWorktreeGit,
    });

    expect(summary).toMatchObject({
      id: "/repo/main",
      path: "/repo/main",
      isMain: true,
      isCurrent: true,
      isDetached: false,
      branch: "feature/test",
      commit: "abcdef1",
      git: {
        status: "ready",
        branch: "feature/test",
        commit: "abcdef1",
      },
    });
    expect(resolveAbsoluteGitDir).toHaveBeenCalledWith("/repo/main");
    expect(inspectWorktreeGit).toHaveBeenCalledWith("/repo/main", {
      branch: "feature/test",
      commit: "abcdef1",
      message: null,
    });
  });

  it("mirrors the sync helper in the async variant", async () => {
    const resolveAbsoluteGitDirAsync = vi.fn(async () => "/repo/.git");
    const inspectWorktreeGitAsync = vi.fn(async () => ({
      status: "ready" as const,
      branch: null,
      commit: "fedcba9",
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: "detached",
    }));

    await expect(
      inspectParsedWorktreeAsync({
        entry: createParsedWorktree({
          path: "/repo/worktrees/detached",
          head: "fedcba9876543210",
          branchRef: null,
          detached: true,
          prunableReason: "detached",
        }),
        currentWorktreeRoot: "/repo/main",
        commonGitDir: "/repo/.git/worktrees/detached",
        existsSync: vi.fn(() => true),
        resolveAbsoluteGitDirAsync,
        inspectWorktreeGitAsync,
      }),
    ).resolves.toMatchObject({
      id: "/repo/worktrees/detached",
      path: "/repo/worktrees/detached",
      isMain: false,
      isCurrent: false,
      isDetached: true,
      prunableReason: "detached",
      branch: null,
      commit: "fedcba9",
      git: {
        status: "ready",
        branch: null,
        commit: "fedcba9",
        message: "detached",
      },
    });
  });
});
