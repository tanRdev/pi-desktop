import type { GitRepositoryStatus, ShellGitSnapshot } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import { createWorktree } from "../../../../test/factories";

import {
  buildGitPanelViewModel,
  formatGitCountsSummary,
} from "./git-panel-model";

const notRepoShellGit: ShellGitSnapshot = { status: "not_repo" };

function makeRepoStatus(
  overrides: Partial<GitRepositoryStatus> = {},
): GitRepositoryStatus {
  return {
    repositoryPath: "/tmp/repo",
    branch: "main",
    commit: "abc1234",
    upstreamBranch: "origin/main",
    summary: createWorktree().git,
    stagedChanges: [],
    unstagedChanges: [],
    conflictedChanges: [],
    ...overrides,
  };
}

describe("formatGitCountsSummary", () => {
  it("returns 'Clean' when all counts are zero", () => {
    const worktree = createWorktree({
      git: { stagedCount: 0, modifiedCount: 0, untrackedCount: 0 },
    });
    expect(formatGitCountsSummary(worktree.git)).toBe("Clean");
  });

  it("joins non-zero counts", () => {
    const worktree = createWorktree({
      git: { stagedCount: 2, modifiedCount: 3, untrackedCount: 0 },
    });
    expect(formatGitCountsSummary(worktree.git)).toBe("2 staged, 3 modified");
  });

  it("includes untracked", () => {
    const worktree = createWorktree({
      git: { stagedCount: 0, modifiedCount: 0, untrackedCount: 5 },
    });
    expect(formatGitCountsSummary(worktree.git)).toBe("5 untracked");
  });
});

describe("buildGitPanelViewModel", () => {
  it("returns 'not a git repository' state when no worktree and shell says not_repo", () => {
    const vm = buildGitPanelViewModel({
      worktree: null,
      repositoryStatus: null,
      repositoryPath: "/tmp/folder",
      shellGit: notRepoShellGit,
    });

    expect(vm.branchLabel).toBe("Not a git repository");
    expect(vm.statusTone).toBe("muted");
    expect(vm.statusMessage).toContain("not a git repository");
    expect(vm.sections).toEqual([
      { title: "Workspace", rows: [{ label: "Path", value: "/tmp/folder" }] },
    ]);
  });

  it("returns 'select a worktree' state when nothing selected", () => {
    const vm = buildGitPanelViewModel({
      worktree: null,
      repositoryStatus: null,
      repositoryPath: null,
      shellGit: null,
    });

    expect(vm.branchLabel).toBe("No worktree");
    expect(vm.summary).toBe("Select a worktree");
    expect(vm.sections).toEqual([]);
    expect(vm.commitActionLabel).toBeNull();
  });

  it("exposes clean ready state with neutral tone and action labels", () => {
    const worktree = createWorktree({
      label: "main",
      path: "/tmp/repo",
      git: {
        status: "ready",
        branch: "feature",
        commit: "c0ffee1",
        stagedCount: 0,
        modifiedCount: 0,
        untrackedCount: 0,
        ahead: 0,
        behind: 0,
      },
    });

    const vm = buildGitPanelViewModel({
      worktree,
      repositoryStatus: null,
      repositoryPath: "/tmp/repo",
      shellGit: null,
    });

    expect(vm.branchLabel).toBe("feature");
    expect(vm.commitLabel).toBe("c0ffee1");
    expect(vm.summary).toBe("Clean");
    expect(vm.syncLabel).toBe("Up to date");
    expect(vm.statusTone).toBe("neutral");
    expect(vm.statusMessage).toBe("Working tree is clean.");
    expect(vm.pullActionLabel).toBe("Pull");
    expect(vm.pushActionLabel).toBe("Push");
    expect(vm.fetchActionLabel).toBe("Fetch");
    expect(vm.commitActionLabel).toBeNull();
    expect(vm.commitAndPushActionLabel).toBeNull();
  });

  it("enables commit when there are staged changes", () => {
    const worktree = createWorktree({
      git: {
        status: "ready",
        branch: "main",
        stagedCount: 2,
        modifiedCount: 1,
        untrackedCount: 0,
        ahead: 1,
        behind: 0,
      },
    });

    const vm = buildGitPanelViewModel({
      worktree,
      repositoryStatus: null,
      repositoryPath: null,
      shellGit: null,
    });

    expect(vm.commitActionLabel).toBe("Commit");
    expect(vm.commitAndPushActionLabel).toBe("Commit & Push");
    expect(vm.statusTone).toBe("warning");
    expect(vm.statusMessage).toBe("Working tree has local changes.");
    expect(vm.syncLabel).toBe("1 ahead");
    expect(vm.summary).toBe("2 staged, 1 modified");
  });

  it("labels detached HEAD worktrees", () => {
    const worktree = createWorktree({
      isDetached: true,
      git: { status: "ready", branch: null },
    });

    const vm = buildGitPanelViewModel({
      worktree,
      repositoryStatus: null,
      repositoryPath: null,
      shellGit: null,
    });

    expect(vm.branchLabel).toBe("Detached HEAD");
  });

  it("reports warning tone for missing status", () => {
    const worktree = createWorktree({
      git: {
        status: "missing",
        message: "no .git",
        branch: null,
        commit: null,
      },
    });

    const vm = buildGitPanelViewModel({
      worktree,
      repositoryStatus: null,
      repositoryPath: null,
      shellGit: null,
    });

    expect(vm.statusTone).toBe("warning");
    expect(vm.statusMessage).toBe("no .git");
    expect(vm.summary).toBe("Git data missing");
    expect(vm.pullActionLabel).toBeNull();
  });

  it("includes a Native Git section when repositoryStatus is provided", () => {
    const worktree = createWorktree({
      git: { status: "ready", branch: "main" },
    });

    const vm = buildGitPanelViewModel({
      worktree,
      repositoryStatus: makeRepoStatus({
        upstreamBranch: "origin/main",
        stagedChanges: [
          {
            path: "a.ts",
            status: "added",
            indexStatus: "added",
            worktreeStatus: null,
          },
        ],
        unstagedChanges: [
          {
            path: "b.ts",
            status: "modified",
            indexStatus: null,
            worktreeStatus: "modified",
          },
          {
            path: "c.ts",
            status: "modified",
            indexStatus: null,
            worktreeStatus: "modified",
          },
        ],
      }),
      repositoryPath: null,
      shellGit: null,
    });

    const nativeSection = vm.sections.find(
      (section) => section.title === "Native Git",
    );
    expect(nativeSection).toBeDefined();
    expect(nativeSection?.rows).toEqual([
      { label: "Staged files", value: "1" },
      { label: "Unstaged files", value: "2" },
      { label: "Conflicts", value: "0" },
    ]);
    expect(vm.upstreamLabel).toBe("origin/main");
  });
});
