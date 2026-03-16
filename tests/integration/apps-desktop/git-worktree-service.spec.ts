import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GitWorktreeService } from "../../../apps/desktop/src/main/git-worktree-service";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      [`git ${args.join(" ")}`, result.stdout, result.stderr].filter(Boolean).join("\n"),
    );
  }

  return result.stdout.trim();
}

function initRepository(name: string, options: { withRemoteHead?: boolean } = {}) {
  const sandbox = createTempDir(`pidesk-git-${name}-`);
  const repoRoot = path.join(sandbox, name);
  fs.mkdirSync(repoRoot, { recursive: true });
  runGit(sandbox, ["init", "-b", "main", repoRoot]);
  runGit(repoRoot, ["config", "user.name", "PiDesk Tests"]);
  runGit(repoRoot, ["config", "user.email", "tests@pidesk.local"]);
  fs.writeFileSync(path.join(repoRoot, "README.md"), "# PiDesk test repo\n");
  runGit(repoRoot, ["add", "README.md"]);
  runGit(repoRoot, ["commit", "-m", "initial"]);

  let remoteRoot: string | null = null;
  if (options.withRemoteHead) {
    remoteRoot = path.join(sandbox, `${name}-remote.git`);
    runGit(sandbox, ["init", "--bare", remoteRoot]);
    runGit(repoRoot, ["remote", "add", "origin", remoteRoot]);
    runGit(repoRoot, ["push", "-u", "origin", "main"]);
    runGit(repoRoot, ["remote", "set-head", "origin", "main"]);
  }

  return { sandbox, repoRoot, remoteRoot };
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("GitWorktreeService", () => {
  it("returns not_repo for directories outside git repositories", () => {
    const service = new GitWorktreeService();
    const nonRepoDir = createTempDir("pidesk-non-repo-");

    expect(service.inspect(nonRepoDir)).toEqual({
      status: "not_repo",
      message: null,
    });
  });

  it("discovers the repository root, remote default branch, and all worktrees from a linked worktree path", () => {
    const { sandbox, repoRoot } = initRepository("linked", { withRemoteHead: true });
    const featureWorktree = path.join(sandbox, "feature-worktree");
    runGit(repoRoot, ["worktree", "add", "-b", "feature/worktree", featureWorktree]);
    const expectedRepoRoot = fs.realpathSync(repoRoot);
    const expectedFeatureWorktree = fs.realpathSync(featureWorktree);
    fs.mkdirSync(path.join(featureWorktree, "nested"), { recursive: true });
    fs.writeFileSync(path.join(featureWorktree, "feature.txt"), "dirty\n");

    const service = new GitWorktreeService();
    const summary = service.inspect(path.join(featureWorktree, "nested"));

    expect(summary).toMatchObject({
      status: "repository",
      rootPath: expectedRepoRoot,
      currentWorktreePath: expectedFeatureWorktree,
      defaultBranch: "main",
    });

    expect(summary.worktrees?.map((worktree) => worktree.path)).toEqual([
      expectedRepoRoot,
      expectedFeatureWorktree,
    ]);

    const mainWorktree = summary.worktrees?.find(
      (worktree) => worktree.path === expectedRepoRoot,
    );
    expect(mainWorktree).toMatchObject({
      isMain: true,
      isCurrent: false,
      branch: "main",
      isDetached: false,
    });

    const currentWorktree = summary.worktrees?.find(
      (worktree) => worktree.path === expectedFeatureWorktree,
    );
    expect(currentWorktree).toMatchObject({
      isMain: false,
      isCurrent: true,
      branch: "feature/worktree",
      isDetached: false,
      git: {
        status: "ready",
        hasChanges: true,
      },
    });
    expect(
      (currentWorktree?.git.modifiedCount ?? 0) +
        (currentWorktree?.git.untrackedCount ?? 0),
    ).toBeGreaterThan(0);
  });

  it("creates a linked worktree from the requested default branch", () => {
    const { sandbox, repoRoot } = initRepository("create", { withRemoteHead: true });
    const worktreePath = path.join(sandbox, "feature-runtime");
    const service = new GitWorktreeService();

    const createdPath = service.createWorktree({
      repositoryRoot: repoRoot,
      branchName: "feature/runtime",
      worktreePath,
      baseBranch: "main",
    });

    expect(fs.existsSync(createdPath)).toBe(true);
    expect(fs.realpathSync(createdPath)).toBe(fs.realpathSync(worktreePath));

    const summary = service.inspect(createdPath);
    const createdWorktree = summary.worktrees?.find(
      (worktree) => worktree.path === fs.realpathSync(createdPath),
    );
    expect(createdWorktree).toMatchObject({
      branch: "feature/runtime",
      isDetached: false,
      isMain: false,
    });
  });


  it("falls back to the main worktree branch when no remote default branch exists and marks detached worktrees", () => {
    const { sandbox, repoRoot } = initRepository("detached");
    const detachedWorktree = path.join(sandbox, "detached-worktree");
    runGit(repoRoot, ["worktree", "add", "--detach", detachedWorktree, "HEAD"]);
    const expectedRepoRoot = fs.realpathSync(repoRoot);
    const expectedDetachedWorktree = fs.realpathSync(detachedWorktree);

    const service = new GitWorktreeService();
    const summary = service.inspect(detachedWorktree);
    const detached = summary.worktrees?.find(
      (worktree) => worktree.path === expectedDetachedWorktree,
    );

    expect(summary).toMatchObject({
      status: "repository",
      rootPath: expectedRepoRoot,
      currentWorktreePath: expectedDetachedWorktree,
      defaultBranch: "main",
    });
    expect(detached).toMatchObject({
      isDetached: true,
      branch: null,
      git: {
        status: "ready",
        branch: null,
      },
    });
  });

  it("represents prunable missing worktrees without crashing inspection", () => {
    const { sandbox, repoRoot } = initRepository("prunable");
    const staleWorktree = path.join(sandbox, "stale-worktree");
    runGit(repoRoot, ["worktree", "add", "-b", "feature/stale", staleWorktree]);
    const expectedStaleWorktree = fs.realpathSync(staleWorktree);
    fs.rmSync(staleWorktree, { recursive: true, force: true });

    const service = new GitWorktreeService();
    const summary = service.inspect(repoRoot);
    const stale = summary.worktrees?.find(
      (worktree) => worktree.path === expectedStaleWorktree,
    );

    expect(stale).toMatchObject({
      isPrunable: true,
      prunableReason: expect.stringContaining("gitdir file points"),
      git: {
        status: "missing",
      },
    });
  });
});
