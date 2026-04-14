import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createShellSnapshot } from "../../../apps/desktop/src/main/shell-snapshot";
import type {
  AgentSnapshot,
  ShellCatalogSnapshot,
} from "../../../packages/shared/src";

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
      [`git ${args.join(" ")}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.stdout.trim();
}

function initRepository(name: string) {
  const sandbox = createTempDir(`pi-desktop-shell-snapshot-${name}-`);
  const repoRoot = path.join(sandbox, name);
  fs.mkdirSync(repoRoot, { recursive: true });
  runGit(sandbox, ["init", "-b", "main", repoRoot]);
  runGit(repoRoot, ["config", "user.name", "Pi Desktop Tests"]);
  runGit(repoRoot, ["config", "user.email", "tests@pi-desktop.local"]);
  fs.writeFileSync(
    path.join(repoRoot, "README.md"),
    "# Pi Desktop test repo\n",
  );
  runGit(repoRoot, ["add", "README.md"]);
  runGit(repoRoot, ["commit", "-m", "initial"]);
  return { sandbox, repoRoot };
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("createShellSnapshot", () => {
  it("builds an empty repository catalog when cwd is not a git repository", () => {
    const nonRepoDir = createTempDir("pi-desktop-non-repo-");
    const snapshot = createShellSnapshot({
      appName: "Pi Desktop",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      electronVersion: "41.0.1",
      platform: "darwin",
      env: { NODE_ENV: "test" },
      isPackaged: false,
      cwd: nonRepoDir,
      agentDir: `${nonRepoDir}/.pi-desktop-agent`,
      agentMode: "mock",
    });

    expect(snapshot).toMatchObject({
      appName: "Pi Desktop",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      mode: "test",
      platform: "darwin",
      runtime: {
        agentMode: "mock",
        electronVersion: "41.0.1",
        agentDirectory: `${nonRepoDir}/.pi-desktop-agent`,
      },
      capabilities: {
        supportsTurns: true,
        supportsTools: true,
        supportsActivity: true,
        supportsParallelSessions: false,
      },
      catalog: {
        repositories: [],
        selection: {
          repositoryId: null,
          worktreeId: null,
          threadId: null,
        },
      },
    });

    expect(snapshot.git).toEqual({
      status: "not_repo",
      message: null,
    });
  });

  it("builds a repo-wide worktree catalog without inventing a thread", () => {
    const { sandbox, repoRoot } = initRepository("catalog");
    const featureWorktree = path.join(sandbox, "feature-worktree");
    runGit(repoRoot, [
      "worktree",
      "add",
      "-b",
      "feature/worktree",
      featureWorktree,
    ]);
    const expectedRepoRoot = fs.realpathSync(repoRoot);
    const expectedFeatureWorktree = fs.realpathSync(featureWorktree);
    fs.mkdirSync(path.join(featureWorktree, "nested"), { recursive: true });
    fs.writeFileSync(path.join(featureWorktree, "feature.txt"), "dirty\n");

    const agentSnapshot: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };
    const snapshot = createShellSnapshot({
      appName: "Pi Desktop",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      electronVersion: "41.0.1",
      platform: "darwin",
      env: { NODE_ENV: "test" },
      isPackaged: false,
      cwd: path.join(featureWorktree, "nested"),
      agentDir: `${featureWorktree}/.pi-desktop-agent`,
      agentMode: "mock",
      agentSnapshot,
    });

    expect(snapshot.workspace?.rootPath).toBe(expectedFeatureWorktree);
    expect(snapshot.catalog.selection).toEqual({
      repositoryId: expectedRepoRoot,
      worktreeId: expectedFeatureWorktree,
      threadId: null,
    });
    expect(snapshot.catalog.repositories).toHaveLength(1);

    const repository = snapshot.catalog.repositories[0];
    expect(repository).toMatchObject({
      id: expectedRepoRoot,
      rootPath: expectedRepoRoot,
      defaultBranch: "main",
    });
    expect(repository?.worktrees.map((worktree) => worktree.path)).toEqual([
      expectedRepoRoot,
      expectedFeatureWorktree,
    ]);

    const mainWorktree = repository?.worktrees.find(
      (worktree) => worktree.path === expectedRepoRoot,
    );
    expect(mainWorktree?.threads).toEqual([]);

    const currentWorktree = repository?.worktrees.find(
      (worktree) => worktree.path === expectedFeatureWorktree,
    );
    expect(currentWorktree).toMatchObject({
      isMain: false,
      isDetached: false,
      git: {
        status: "ready",
        branch: "feature/worktree",
        hasChanges: true,
      },
      threads: [],
    });

    expect(snapshot.git).toMatchObject({
      status: "repository",
      rootPath: expectedRepoRoot,
      branch: "feature/worktree",
      hasChanges: true,
    });
  });

  it("reuses provided catalog for active workspace and git snapshot", () => {
    const nonRepoDir = createTempDir("pi-desktop-catalog-reuse-");
    const catalog: ShellCatalogSnapshot = {
      selection: {
        repositoryId: "/tmp/repo",
        worktreeId: "/tmp/repo/feature",
        threadId: "thread-1",
      },
      repositories: [
        {
          id: "/tmp/repo",
          name: "repo",
          rootPath: "/tmp/repo",
          defaultBranch: "main",
          worktrees: [
            {
              id: "/tmp/repo/feature",
              label: "feature",
              path: "/tmp/repo/feature",
              isMain: false,
              isDetached: false,
              git: {
                status: "ready",
                branch: "feature",
                commit: "abc1234",
                hasChanges: true,
                ahead: 2,
                behind: 1,
                stagedCount: 3,
                modifiedCount: 4,
                untrackedCount: 5,
                message: null,
              },
              threads: [
                {
                  id: "thread-1",
                  title: "Thread 1",
                  isArchived: false,
                  lastActivityAt: null,
                  runtime: {
                    status: "ready",
                    lastError: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const snapshot = createShellSnapshot({
      appName: "Pi Desktop",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      electronVersion: "41.0.1",
      platform: "darwin",
      env: { NODE_ENV: "test" },
      isPackaged: false,
      cwd: nonRepoDir,
      agentDir: `${nonRepoDir}/.pi-desktop-agent`,
      agentMode: "mock",
      catalog,
    });

    expect(snapshot.workspace?.rootPath).toBe("/tmp/repo/feature");
    expect(snapshot.git).toEqual({
      status: "repository",
      rootPath: "/tmp/repo",
      branch: "feature",
      commit: "abc1234",
      hasChanges: true,
      ahead: 2,
      behind: 1,
      stagedCount: 3,
      modifiedCount: 4,
      untrackedCount: 5,
      message: null,
    });
  });
});
