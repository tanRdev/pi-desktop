import { describe, expect, it } from "vitest";
import {
  inspectWorktreeGitSummary,
  inspectWorktreeGitSummaryAsync,
} from "./worktree-git-summary";

describe("worktree git summary helper", () => {
  it("parses branch metadata and change counts from git status output", async () => {
    const branchStatusOutput = [
      "# branch.oid 1234567890abcdef",
      "# branch.head feature/slice",
      "# branch.ab +2 -3",
    ].join("\n");
    const changesOutput = [
      "M  staged.txt",
      " M modified.txt",
      "MM both.txt",
      "?? new.txt",
    ].join("\n");

    const syncSummary = inspectWorktreeGitSummary(
      (cwd, args) => {
        expect(cwd).toBe("/repo/worktree");

        if (args[1] === "--porcelain=2") {
          return {
            status: 0,
            stdout: branchStatusOutput,
            stderr: "",
            error: null,
          };
        }

        return {
          status: 0,
          stdout: changesOutput,
          stderr: "",
          error: null,
        };
      },
      "/repo/worktree",
      {
        branch: "fallback",
        commit: "fedcba9",
        message: "prunable",
      },
    );

    const asyncSummary = await inspectWorktreeGitSummaryAsync(
      async (_cwd, args) => {
        if (args[1] === "--porcelain=2") {
          return {
            status: 0,
            stdout: branchStatusOutput,
            stderr: "",
            error: null,
          };
        }

        return {
          status: 0,
          stdout: changesOutput,
          stderr: "",
          error: null,
        };
      },
      "/repo/worktree",
      {
        branch: "fallback",
        commit: "fedcba9",
        message: "prunable",
      },
    );

    expect(syncSummary).toEqual({
      status: "ready",
      branch: "feature/slice",
      commit: "1234567",
      hasChanges: true,
      ahead: 2,
      behind: 3,
      stagedCount: 2,
      modifiedCount: 2,
      untrackedCount: 1,
      message: "prunable",
    });
    expect(asyncSummary).toEqual(syncSummary);
  });

  it("preserves fallback branch, commit, and message when status output omits them", () => {
    const summary = inspectWorktreeGitSummary(
      (_cwd, args) => ({
        status: 0,
        stdout: args[1] === "--porcelain=2" ? "# branch.oid (initial)" : "",
        stderr: "",
        error: null,
      }),
      "/repo/worktree",
      {
        branch: "feature/fallback",
        commit: "7654321",
        message: "fallback message",
      },
    );

    expect(summary).toEqual({
      status: "ready",
      branch: "feature/fallback",
      commit: "7654321",
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: "fallback message",
    });
  });

  it("reports detached heads and unavailable states with the existing messages", async () => {
    const detachedSummary = inspectWorktreeGitSummary(
      (_cwd, args) => ({
        status: 0,
        stdout:
          args[1] === "--porcelain=2"
            ? [
                "# branch.oid abcdef1234567890",
                "# branch.head (detached)",
              ].join("\n")
            : "",
        stderr: "",
        error: null,
      }),
      "/repo/worktree",
      {
        branch: "feature/fallback",
        commit: "7654321",
        message: null,
      },
    );

    const unavailableFromError = inspectWorktreeGitSummary(
      () => ({
        status: 1,
        stdout: "",
        stderr: "",
        error: new Error("spawn git ENOENT"),
      }),
      "/repo/worktree",
      {
        branch: null,
        commit: null,
        message: null,
      },
    );

    const unavailableFromAsyncStatus = await inspectWorktreeGitSummaryAsync(
      async (_cwd, args) => ({
        status: args[1] === "--porcelain=2" ? 0 : 1,
        stdout: args[1] === "--porcelain=2" ? "# branch.head main" : "",
        stderr: args[1] === "--porcelain=2" ? "" : "changes failed",
        error: null,
      }),
      "/repo/worktree",
      {
        branch: "main",
        commit: "7654321",
        message: null,
      },
    );

    expect(detachedSummary).toEqual({
      status: "ready",
      branch: null,
      commit: "abcdef1",
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: null,
    });
    expect(unavailableFromError).toEqual({
      status: "unavailable",
      branch: null,
      commit: null,
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: "spawn git ENOENT",
    });
    expect(unavailableFromAsyncStatus).toEqual({
      status: "unavailable",
      branch: null,
      commit: null,
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: "changes failed",
    });
  });
});
