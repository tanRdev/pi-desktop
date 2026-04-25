import { describe, expect, it } from "vitest";
import type { GitCommandResult, RunGit } from "./git-command-runner";
import { buildCreateWorktreeCommand } from "./worktree-creation";

function createResult(
  overrides: Partial<GitCommandResult> = {},
): GitCommandResult {
  return {
    status: 0,
    stdout: "",
    stderr: "",
    error: null,
    ...overrides,
  };
}

describe("worktree-creation", () => {
  it("reuses an existing branch without checking a base branch", () => {
    const calls: string[] = [];
    const runGit: RunGit = (cwd, args) => {
      expect(cwd).toBe("/repo/main");
      calls.push(args.join(" "));

      return createResult();
    };

    expect(
      buildCreateWorktreeCommand(runGit, {
        repositoryRoot: "/repo/main",
        branchName: "feature/existing",
        worktreePath: "/repo/worktrees/feature-existing",
        baseBranch: "main",
      }),
    ).toEqual([
      "worktree",
      "add",
      "/repo/worktrees/feature-existing",
      "feature/existing",
    ]);

    expect(calls).toEqual(["show-ref --verify refs/heads/feature/existing"]);
  });

  it("creates a new branch from a matching local base branch", () => {
    const runGit: RunGit = (_cwd, args) => {
      if (args[2] === "refs/heads/feature/new") {
        return createResult({ status: 1 });
      }

      if (args[2] === "refs/heads/develop") {
        return createResult();
      }

      return createResult({ status: 1 });
    };

    expect(
      buildCreateWorktreeCommand(runGit, {
        repositoryRoot: "/repo/main",
        branchName: "feature/new",
        worktreePath: "/repo/worktrees/feature-new",
        baseBranch: "develop",
      }),
    ).toEqual([
      "worktree",
      "add",
      "-b",
      "feature/new",
      "/repo/worktrees/feature-new",
      "develop",
    ]);
  });

  it("falls back to the origin base branch when the local base branch is missing", () => {
    const runGit: RunGit = (_cwd, args) => {
      if (args[2] === "refs/heads/feature/new") {
        return createResult({ status: 1 });
      }

      if (args[2] === "refs/heads/main") {
        return createResult({ status: 1 });
      }

      if (args[2] === "refs/remotes/origin/main") {
        return createResult();
      }

      return createResult({ status: 1 });
    };

    expect(
      buildCreateWorktreeCommand(runGit, {
        repositoryRoot: "/repo/main",
        branchName: "feature/new",
        worktreePath: "/repo/worktrees/feature-new",
        baseBranch: "main",
      }),
    ).toEqual([
      "worktree",
      "add",
      "-b",
      "feature/new",
      "/repo/worktrees/feature-new",
      "origin/main",
    ]);
  });

  it("creates a new branch without a start ref when no base branch resolves", () => {
    const runGit: RunGit = () => createResult({ status: 1 });

    expect(
      buildCreateWorktreeCommand(runGit, {
        repositoryRoot: "/repo/main",
        branchName: "feature/new",
        worktreePath: "/repo/worktrees/feature-new",
        baseBranch: "main",
      }),
    ).toEqual([
      "worktree",
      "add",
      "-b",
      "feature/new",
      "/repo/worktrees/feature-new",
    ]);
  });
});
