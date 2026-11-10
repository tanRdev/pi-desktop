import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitServiceImpl } from "./git-service-impl";
import type { WorktreeSetupStageEvent } from "./worktree-setup";

/**
 * Real-git coverage for the staged worktree setup (issue #12):
 * stages are reported, a retry after creation reuses the checkout
 * instead of duplicating it, and a failed attempt leaves the
 * existing checkout untouched.
 */

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

describe("GitServiceImpl createWorktree (real git)", () => {
  let root: string;
  let repositoryRoot: string;
  let worktreePath: string;
  const service = new GitServiceImpl();

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "pi-desktop-wt-setup-"));
    repositoryRoot = path.join(root, "repo");
    worktreePath = path.join(root, "worktrees", "feature");
    mkdirSync(repositoryRoot, { recursive: true });
    git(repositoryRoot, ["init", "-b", "main"]);
    git(repositoryRoot, ["config", "user.email", "test@example.com"]);
    git(repositoryRoot, ["config", "user.name", "Test"]);
    writeFileSync(path.join(repositoryRoot, "README.md"), "hello\n");
    git(repositoryRoot, ["add", "README.md"]);
    git(repositoryRoot, ["commit", "-m", "init"]);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function worktreeListPaths(): string[] {
    return git(repositoryRoot, ["worktree", "list", "--porcelain"])
      .split("\n")
      .filter((line) => line.startsWith("worktree "))
      .map((line) => line.replace("worktree ", ""));
  }

  it("creates a worktree and reports the setup stages", () => {
    const events: WorktreeSetupStageEvent[] = [];

    const created = service.createWorktree({
      repositoryRoot,
      branchName: "feature",
      worktreePath,
      onStage: (event) => events.push(event),
    });

    expect(created).toBe(worktreePath);
    expect(existsSync(path.join(worktreePath, "README.md"))).toBe(true);
    expect(
      git(worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(),
    ).toBe("feature");
    expect(events.map((event) => `${event.stage}:${event.status}`)).toEqual([
      "validate:started",
      "validate:completed",
      "prepare-directory:started",
      "prepare-directory:completed",
      "resolve-branch:started",
      "resolve-branch:completed",
      "create-worktree:started",
      "create-worktree:completed",
      "ready:completed",
    ]);
  });

  it("retrying creation reuses the checkout and creates no duplicate", () => {
    service.createWorktree({
      repositoryRoot,
      branchName: "feature",
      worktreePath,
    });

    const events: WorktreeSetupStageEvent[] = [];
    const retried = service.createWorktree({
      repositoryRoot,
      branchName: "feature",
      worktreePath,
      onStage: (event) => events.push(event),
    });

    expect(retried).toBe(worktreePath);
    expect(
      worktreeListPaths().filter((entry) => entry === worktreePath),
    ).toHaveLength(1);
    expect(events).toContainEqual({
      stage: "create-worktree",
      status: "completed",
      message: "Existing worktree reused",
    });
  });

  it("keeps the existing checkout when a conflicting retry fails", () => {
    service.createWorktree({
      repositoryRoot,
      branchName: "feature",
      worktreePath,
    });

    expect(() =>
      service.createWorktree({
        repositoryRoot,
        branchName: "other",
        worktreePath,
      }),
    ).toThrow("already registered for branch feature");

    expect(existsSync(path.join(worktreePath, "README.md"))).toBe(true);
    expect(
      git(worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(),
    ).toBe("feature");
    expect(worktreeListPaths()).toContain(worktreePath);
  });
});
