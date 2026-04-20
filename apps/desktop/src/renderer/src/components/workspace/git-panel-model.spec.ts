import type { GitRepositoryStatus, ShellGitSnapshot } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import { createWorktree } from "../../../../test/factories";

import {
  applyCommitTemplate,
  buildFileStageEntries,
  buildGitPanelViewModel,
  DEFAULT_COMMIT_TEMPLATES,
  formatGitCountsSummary,
  nextFocusIndex,
  resolveFocusedPath,
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

describe("applyCommitTemplate", () => {
  const feat = DEFAULT_COMMIT_TEMPLATES.find((t) => t.id === "feat");
  const fix = DEFAULT_COMMIT_TEMPLATES.find((t) => t.id === "fix");

  it("prepends template prefix to empty messages", () => {
    if (!feat) throw new Error("missing feat template");
    expect(applyCommitTemplate("", feat)).toBe("feat: ");
    expect(applyCommitTemplate("   ", feat)).toBe("feat: ");
  });

  it("replaces existing conventional-commit prefix", () => {
    if (!feat || !fix) throw new Error("missing templates");
    expect(applyCommitTemplate("feat: add thing", fix)).toBe("fix: add thing");
    expect(applyCommitTemplate("chore(scope): do it", feat)).toBe(
      "feat: do it",
    );
  });

  it("prepends when there is no known prefix", () => {
    if (!feat) throw new Error("missing template");
    expect(applyCommitTemplate("just a note", feat)).toBe("feat: just a note");
  });
});

describe("buildFileStageEntries", () => {
  it("returns empty list when status is null", () => {
    expect(buildFileStageEntries(null)).toEqual([]);
  });

  it("classifies staged-only, unstaged-only, and partial files", () => {
    const entries = buildFileStageEntries(
      makeRepoStatus({
        stagedChanges: [
          {
            path: "a.ts",
            status: "added",
            indexStatus: "added",
            worktreeStatus: null,
          },
          {
            path: "c.ts",
            status: "modified",
            indexStatus: "modified",
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
          {
            path: "d.ts",
            status: "untracked",
            indexStatus: null,
            worktreeStatus: "untracked",
          },
        ],
      }),
    );

    const byPath = Object.fromEntries(entries.map((e) => [e.path, e.state]));
    expect(byPath["a.ts"]).toBe("staged");
    expect(byPath["b.ts"]).toBe("unstaged");
    expect(byPath["c.ts"]).toBe("partial");
    expect(byPath["d.ts"]).toBe("untracked");
  });

  it("marks conflicted files as conflicted regardless of staged/unstaged", () => {
    const entries = buildFileStageEntries(
      makeRepoStatus({
        conflictedChanges: [
          {
            path: "conflict.ts",
            status: "unmerged",
            indexStatus: "unmerged",
            worktreeStatus: "unmerged",
          },
        ],
      }),
    );

    expect(entries).toEqual([
      { path: "conflict.ts", state: "conflicted", status: "unmerged" },
    ]);
  });
});

describe("nextFocusIndex / resolveFocusedPath", () => {
  it("clamps at bounds and moves by direction", () => {
    expect(nextFocusIndex(0, 3, 1)).toBe(1);
    expect(nextFocusIndex(2, 3, 1)).toBe(2);
    expect(nextFocusIndex(0, 3, -1)).toBe(0);
    expect(nextFocusIndex(1, 3, -1)).toBe(0);
  });

  it("returns 0 when list is empty", () => {
    expect(nextFocusIndex(5, 0, 1)).toBe(0);
  });

  it("resolves focused path from entries", () => {
    const entries = buildFileStageEntries(
      makeRepoStatus({
        stagedChanges: [
          {
            path: "a.ts",
            status: "added",
            indexStatus: "added",
            worktreeStatus: null,
          },
          {
            path: "b.ts",
            status: "modified",
            indexStatus: "modified",
            worktreeStatus: null,
          },
        ],
      }),
    );
    expect(resolveFocusedPath(entries, 0)).toBe("a.ts");
    expect(resolveFocusedPath(entries, 1)).toBe("b.ts");
    expect(resolveFocusedPath(entries, 99)).toBe("b.ts");
    expect(resolveFocusedPath([], 0)).toBeNull();
  });
});
