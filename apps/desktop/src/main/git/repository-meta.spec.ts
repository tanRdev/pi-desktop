import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  GitCommandResult,
  RunGit,
  RunGitAsync,
} from "./git-command-runner";
import {
  detectDefaultBranch,
  detectDefaultBranchAsync,
  resolveAbsoluteGitDir,
  resolveAbsoluteGitDirAsync,
  resolveCommonGitDir,
  resolveCommonGitDirAsync,
  resolveCurrentWorktreeRoot,
  resolveCurrentWorktreeRootAsync,
  resolveUpstreamBranch,
} from "./repository-meta";

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

describe("repository-meta", () => {
  it("resolves the current worktree root from git output", () => {
    const runGit: RunGit = (cwd, args) => {
      expect(cwd).toBe("/repo/worktrees/feature");
      expect(args).toEqual(["rev-parse", "--show-toplevel"]);
      return createResult({ stdout: "/repo/main\n" });
    };

    expect(resolveCurrentWorktreeRoot(runGit, "/repo/worktrees/feature")).toBe(
      "/repo/main",
    );
  });

  it("returns null when resolving the current worktree root fails", () => {
    const runGit: RunGit = () =>
      createResult({ status: 128, stderr: "fatal: not a git repository" });

    expect(resolveCurrentWorktreeRoot(runGit, "/tmp/outside")).toBeNull();
  });

  it("resolves a relative common git dir against the worktree root", () => {
    const runGit: RunGit = () => createResult({ stdout: ".git\n" });

    expect(resolveCommonGitDir(runGit, "/repo/main")).toBe(
      path.normalize("/repo/main/.git"),
    );
  });

  it("returns the absolute git dir when available", () => {
    const runGit: RunGit = () =>
      createResult({ stdout: "/repo/.git/worktrees/feature\n" });

    expect(resolveAbsoluteGitDir(runGit, "/repo/worktrees/feature")).toBe(
      "/repo/.git/worktrees/feature",
    );
  });

  it("prefers origin HEAD when detecting the default branch", () => {
    const calls: string[] = [];
    const runGit: RunGit = (_cwd, args) => {
      calls.push(args.join(" "));
      if (args[0] === "remote") {
        return createResult({ stdout: "fork\norigin\n" });
      }

      expect(args).toEqual([
        "symbolic-ref",
        "--quiet",
        "refs/remotes/origin/HEAD",
      ]);
      return createResult({ stdout: "refs/remotes/origin/main\n" });
    };

    expect(detectDefaultBranch(runGit, "/repo/main", "develop")).toBe("main");
    expect(calls).toEqual([
      "remote",
      "symbolic-ref --quiet refs/remotes/origin/HEAD",
    ]);
  });

  it("falls back to the provided branch when remote HEAD is unavailable", () => {
    const runGit: RunGit = (_cwd, args) => {
      if (args[0] === "remote") {
        return createResult({ stdout: "upstream\n" });
      }

      return createResult({ status: 1 });
    };

    expect(detectDefaultBranch(runGit, "/repo/main", "develop")).toBe(
      "develop",
    );
  });

  it("resolves the upstream branch from git output", () => {
    const runGit: RunGit = (cwd, args) => {
      expect(cwd).toBe("/repo/main");
      expect(args).toEqual([
        "rev-parse",
        "--abbrev-ref",
        "--symbolic-full-name",
        "@{upstream}",
      ]);
      return createResult({ stdout: "origin/feature\n" });
    };

    expect(resolveUpstreamBranch(runGit, "/repo/main")).toBe("origin/feature");
  });

  it("mirrors the sync helpers in async variants", async () => {
    const runGitAsync: RunGitAsync = async (_cwd, args) => {
      if (args[1] === "--show-toplevel") {
        return createResult({ stdout: "/repo/main\n" });
      }

      if (args[1] === "--git-common-dir") {
        return createResult({ stdout: ".git\n" });
      }

      if (args[1] === "--absolute-git-dir") {
        return createResult({ stdout: "/repo/.git/worktrees/feature\n" });
      }

      if (args[0] === "remote") {
        return createResult({ stdout: "origin\n" });
      }

      return createResult({ stdout: "refs/remotes/origin/main\n" });
    };

    await expect(
      resolveCurrentWorktreeRootAsync(runGitAsync, "/repo/worktrees/feature"),
    ).resolves.toBe("/repo/main");
    await expect(
      resolveCommonGitDirAsync(runGitAsync, "/repo/main"),
    ).resolves.toBe(path.normalize("/repo/main/.git"));
    await expect(
      resolveAbsoluteGitDirAsync(runGitAsync, "/repo/worktrees/feature"),
    ).resolves.toBe("/repo/.git/worktrees/feature");
    await expect(
      detectDefaultBranchAsync(runGitAsync, "/repo/main", "develop"),
    ).resolves.toBe("main");
  });
});
