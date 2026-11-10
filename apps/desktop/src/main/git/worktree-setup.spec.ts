import { describe, expect, it, vi } from "vitest";
import type { GitCommandResult, RunGit } from "./git-command-runner";
import {
  runCreateWorktreeWithStages,
  type WorktreeSetupStageEvent,
} from "./worktree-setup";

function result(overrides: Partial<GitCommandResult> = {}): GitCommandResult {
  return { status: 0, stdout: "", stderr: "", error: null, ...overrides };
}

const MAIN_LIST = [
  "worktree /repo/main",
  "HEAD abc123",
  "branch refs/heads/main",
  "",
].join("\n");

function createHarness(runGit: RunGit, events: WorktreeSetupStageEvent[] = []) {
  const ensureParentDirectory = vi.fn();
  return {
    events,
    ensureParentDirectory,
    deps: {
      runGit,
      ensureParentDirectory,
      normalizePath: (p: string) => p,
    },
    options: {
      repositoryRoot: "/repo/main",
      branchName: "feature",
      worktreePath: "/repo/worktrees/feature",
      onStage: (event: WorktreeSetupStageEvent) => events.push(event),
    },
  };
}

describe("runCreateWorktreeWithStages", () => {
  it("reports each stage in order for a fresh worktree", () => {
    const calls: string[] = [];
    const runGit: RunGit = (_cwd, args) => {
      calls.push(args.join(" "));
      if (args[0] === "worktree" && args[1] === "list") {
        return result({ stdout: MAIN_LIST });
      }
      if (args[0] === "worktree" && args[1] === "add") {
        return result();
      }
      // Branch does not exist yet; create it from HEAD.
      return result({ status: 1 });
    };
    const harness = createHarness(runGit);

    expect(runCreateWorktreeWithStages(harness.deps, harness.options)).toBe(
      "/repo/worktrees/feature",
    );

    expect(harness.ensureParentDirectory).toHaveBeenCalledWith(
      "/repo/worktrees/feature",
    );
    expect(calls).toContain("worktree add -b feature /repo/worktrees/feature");
    expect(harness.events).toEqual([
      { stage: "validate", status: "started" },
      { stage: "validate", status: "completed" },
      { stage: "prepare-directory", status: "started" },
      { stage: "prepare-directory", status: "completed" },
      { stage: "resolve-branch", status: "started" },
      { stage: "resolve-branch", status: "completed" },
      { stage: "create-worktree", status: "started" },
      { stage: "create-worktree", status: "completed" },
      { stage: "ready", status: "completed" },
    ]);
  });

  it("reuses an existing worktree for the same branch without a duplicate add", () => {
    const calls: string[] = [];
    const list = [
      MAIN_LIST.trimEnd(),
      "",
      "worktree /repo/worktrees/feature",
      "HEAD def456",
      "branch refs/heads/feature",
      "",
    ].join("\n");
    const runGit: RunGit = (_cwd, args) => {
      calls.push(args.join(" "));
      if (args[0] === "worktree" && args[1] === "list") {
        return result({ stdout: list });
      }
      return result();
    };
    const harness = createHarness(runGit);

    expect(runCreateWorktreeWithStages(harness.deps, harness.options)).toBe(
      "/repo/worktrees/feature",
    );

    expect(calls.some((call) => call.startsWith("worktree add"))).toBe(false);
    expect(harness.events).toContainEqual({
      stage: "create-worktree",
      status: "completed",
      message: "Existing worktree reused",
    });
    expect(harness.events.at(-1)).toEqual({
      stage: "ready",
      status: "completed",
    });
  });

  it("refuses to reuse a checkout registered for a different branch and keeps it", () => {
    const calls: string[] = [];
    const list = [
      MAIN_LIST.trimEnd(),
      "",
      "worktree /repo/worktrees/feature",
      "HEAD def456",
      "branch refs/heads/other",
      "",
    ].join("\n");
    const runGit: RunGit = (_cwd, args) => {
      calls.push(args.join(" "));
      if (args[0] === "worktree" && args[1] === "list") {
        return result({ stdout: list });
      }
      return result();
    };
    const harness = createHarness(runGit);

    expect(() =>
      runCreateWorktreeWithStages(harness.deps, harness.options),
    ).toThrow("already registered for branch other");

    expect(calls.some((call) => call.startsWith("worktree add"))).toBe(false);
    expect(calls.some((call) => call.startsWith("worktree remove"))).toBe(
      false,
    );
    expect(harness.events.at(-1)).toEqual({
      stage: "create-worktree",
      status: "failed",
      message: "Worktree path is already registered for branch other",
    });
  });

  it("fails at the create-worktree stage without issuing any removal when git add fails", () => {
    const calls: string[] = [];
    const runGit: RunGit = (_cwd, args) => {
      calls.push(args.join(" "));
      if (args[0] === "worktree" && args[1] === "list") {
        return result({ stdout: MAIN_LIST });
      }
      if (args[0] === "worktree" && args[1] === "add") {
        return result({ status: 1, stderr: "fatal: cannot lock ref" });
      }
      return result({ status: 1 });
    };
    const harness = createHarness(runGit);

    expect(() =>
      runCreateWorktreeWithStages(harness.deps, harness.options),
    ).toThrow("fatal: cannot lock ref");

    expect(calls.some((call) => call.startsWith("worktree remove"))).toBe(
      false,
    );
    expect(harness.events.at(-1)).toEqual({
      stage: "create-worktree",
      status: "failed",
      message: "fatal: cannot lock ref",
    });
  });

  it("fails validation for an empty branch before touching git", () => {
    const runGit = vi.fn(() => result());
    const harness = createHarness(runGit as unknown as RunGit);

    expect(() =>
      runCreateWorktreeWithStages(harness.deps, {
        ...harness.options,
        branchName: "   ",
      }),
    ).toThrow("Worktree branch name must not be empty");

    expect(runGit).not.toHaveBeenCalled();
    expect(harness.events.at(-1)?.stage).toBe("validate");
    expect(harness.events.at(-1)?.status).toBe("failed");
  });

  it("fails at resolve-branch when the requested base branch is missing", () => {
    const runGit: RunGit = (_cwd, args) => {
      if (args[0] === "worktree" && args[1] === "list") {
        return result({ stdout: MAIN_LIST });
      }
      return result({ status: 1 });
    };
    const harness = createHarness(runGit);

    expect(() =>
      runCreateWorktreeWithStages(harness.deps, {
        ...harness.options,
        baseBranch: "missing-base",
      }),
    ).toThrow("Requested base branch does not exist: missing-base");

    expect(harness.events.at(-1)).toEqual({
      stage: "resolve-branch",
      status: "failed",
      message: "Requested base branch does not exist: missing-base",
    });
  });
});
