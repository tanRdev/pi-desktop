import { describe, expect, it, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AgentSnapshot } from "../../../packages/shared/src";
import { createShellSnapshot } from "../../../apps/desktop/src/main/shell-snapshot";

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

function initRepository(name: string) {
  const sandbox = createTempDir(`pidesk-shell-snapshot-${name}-`);
  const repoRoot = path.join(sandbox, name);
  fs.mkdirSync(repoRoot, { recursive: true });
  runGit(sandbox, ["init", "-b", "main", repoRoot]);
  runGit(repoRoot, ["config", "user.name", "PiDesk Tests"]);
  runGit(repoRoot, ["config", "user.email", "tests@pidesk.local"]);
  fs.writeFileSync(path.join(repoRoot, "README.md"), "# PiDesk test repo\n");
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
    const nonRepoDir = createTempDir("pidesk-non-repo-");
    const snapshot = createShellSnapshot({
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      electronVersion: "41.0.1",
      platform: "darwin",
      env: { NODE_ENV: "test" },
      isPackaged: false,
      cwd: nonRepoDir,
      agentDir: `${nonRepoDir}/.pidesk-agent`,
      agentMode: "mock",
    });

    expect(snapshot).toMatchObject({
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      mode: "test",
      platform: "darwin",
      runtime: {
        agentMode: "mock",
        electronVersion: "41.0.1",
        agentDirectory: `${nonRepoDir}/.pidesk-agent`,
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

  it("builds a repo-wide worktree catalog and selects the current linked worktree thread", () => {
    const { sandbox, repoRoot } = initRepository("catalog");
    const featureWorktree = path.join(sandbox, "feature-worktree");
    runGit(repoRoot, ["worktree", "add", "-b", "feature/worktree", featureWorktree]);
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
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      electronVersion: "41.0.1",
      platform: "darwin",
      env: { NODE_ENV: "test" },
      isPackaged: false,
      cwd: path.join(featureWorktree, "nested"),
      agentDir: `${featureWorktree}/.pidesk-agent`,
      agentMode: "mock",
      agentSnapshot,
    });

    expect(snapshot.workspace?.rootPath).toBe(expectedFeatureWorktree);
    expect(snapshot.catalog.selection).toEqual({
      repositoryId: expectedRepoRoot,
      worktreeId: expectedFeatureWorktree,
      threadId: "default-thread",
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
      threads: [
        {
          id: "default-thread",
          title: "Current thread",
          isArchived: false,
          lastActivityAt: null,
          runtime: {
            status: "ready",
            lastError: null,
          },
        },
      ],
    });

    expect(snapshot.git).toMatchObject({
      status: "repository",
      rootPath: expectedRepoRoot,
      branch: "feature/worktree",
      hasChanges: true,
    });
  });
});
