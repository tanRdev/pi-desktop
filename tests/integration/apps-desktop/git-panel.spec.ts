import { describe, expect, it } from "vitest";
import {
  buildGitPanelViewModel,
  formatGitCountsSummary,
} from "../../../apps/desktop/src/renderer/src/components/workspace/git-panel-model";
import type {
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeGitSnapshot,
  WorktreeSnapshot,
} from "../../../packages/shared/src";

function createGitSnapshot(
  overrides: Partial<WorktreeGitSnapshot> = {},
): WorktreeGitSnapshot {
  return {
    status: "ready",
    branch: "main",
    commit: "abc1234",
    hasChanges: false,
    ahead: 0,
    behind: 0,
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    message: null,
    ...overrides,
  };
}

function createWorktree(
  overrides: Partial<WorktreeSnapshot> = {},
): WorktreeSnapshot {
  return {
    id: "repo-main",
    label: "main",
    path: "/tmp/pi-desktop",
    isMain: true,
    isDetached: false,
    git: createGitSnapshot(),
    threads: [],
    ...overrides,
  };
}

function createRepositoryStatus(
  overrides: Partial<GitRepositoryStatus> = {},
): GitRepositoryStatus {
  return {
    repositoryPath: "/tmp/pi-desktop",
    branch: "main",
    commit: "abc1234",
    upstreamBranch: "origin/main",
    summary: createGitSnapshot(),
    stagedChanges: [],
    unstagedChanges: [],
    conflictedChanges: [],
    ...overrides,
  };
}

function createShellGitSnapshot(
  overrides: Partial<ShellGitSnapshot> = {},
): ShellGitSnapshot {
  return {
    status: "repository",
    rootPath: "/tmp/pi-desktop",
    branch: "main",
    commit: "abc1234",
    hasChanges: false,
    ahead: 0,
    behind: 0,
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    message: null,
    ...overrides,
  };
}

describe("git-panel view model", () => {
  it("formats a clean summary when the worktree has no changes", () => {
    expect(formatGitCountsSummary(createGitSnapshot())).toBe("Clean");
  });

  it("formats staged, modified, and untracked counts in a stable order", () => {
    expect(
      formatGitCountsSummary(
        createGitSnapshot({
          hasChanges: true,
          stagedCount: 2,
          modifiedCount: 3,
          untrackedCount: 1,
        }),
      ),
    ).toBe("2 staged, 3 modified, 1 untracked");
  });

  it("builds a clean repository state with sync details and a git action", () => {
    const viewModel = buildGitPanelViewModel({
      worktree: createWorktree({
        label: "release",
        path: "/tmp/pi-desktop/release",
        git: createGitSnapshot({
          branch: "release",
          commit: "7654321",
          ahead: 2,
          behind: 1,
        }),
      }),
      repositoryStatus: createRepositoryStatus({
        repositoryPath: "/tmp/pi-desktop/release",
      }),
    });

    expect(viewModel.title).toBe("Git");
    expect(viewModel.branchLabel).toBe("release");
    expect(viewModel.commitLabel).toBe("7654321");
    expect(viewModel.summary).toBe("Clean");
    expect(viewModel.syncLabel).toBe("2 ahead, 1 behind");
    expect(viewModel.commitActionLabel).toBe("Commit changes");
    expect(viewModel.pullActionLabel).toBe("Pull");
    expect(viewModel.pushActionLabel).toBe("Push");
    expect(viewModel.statusTone).toBe("neutral");
    expect(viewModel.statusMessage).toBe("Working tree is clean.");
    expect(viewModel.sections).toEqual([
      {
        title: "Changes",
        rows: [
          { label: "Summary", value: "Clean" },
          { label: "Branch", value: "release" },
          { label: "Commit", value: "7654321" },
          { label: "Sync", value: "2 ahead, 1 behind" },
          { label: "Upstream", value: "origin/main" },
        ],
      },
      {
        title: "Native Git",
        rows: [
          { label: "Staged files", value: "0" },
          { label: "Unstaged files", value: "0" },
          { label: "Conflicts", value: "0" },
        ],
      },
      {
        title: "Workspace",
        rows: [
          { label: "Worktree", value: "release" },
          { label: "Path", value: "/tmp/pi-desktop/release" },
        ],
      },
    ]);
  });

  it("surfaces unavailable git state without pretending actions exist", () => {
    const viewModel = buildGitPanelViewModel({
      worktree: createWorktree({
        git: createGitSnapshot({
          status: "unavailable",
          branch: null,
          commit: null,
          message: "Git CLI unavailable",
        }),
      }),
      repositoryStatus: null,
    });

    expect(viewModel.branchLabel).toBe("Unavailable");
    expect(viewModel.commitLabel).toBe("No commit");
    expect(viewModel.summary).toBe("Git unavailable");
    expect(viewModel.syncLabel).toBe("No remote tracking");
    expect(viewModel.commitActionLabel).toBeNull();
    expect(viewModel.pullActionLabel).toBeNull();
    expect(viewModel.pushActionLabel).toBeNull();
    expect(viewModel.statusTone).toBe("warning");
    expect(viewModel.statusMessage).toBe("Git CLI unavailable");
  });

  it("shows an empty selection state when no worktree is active", () => {
    const viewModel = buildGitPanelViewModel({
      worktree: null,
      repositoryStatus: null,
      repositoryPath: null,
      shellGit: null,
    });

    expect(viewModel.branchLabel).toBe("No worktree");
    expect(viewModel.commitLabel).toBe("No commit");
    expect(viewModel.summary).toBe("Select a worktree");
    expect(viewModel.syncLabel).toBe("Git data unavailable");
    expect(viewModel.commitActionLabel).toBeNull();
    expect(viewModel.pullActionLabel).toBeNull();
    expect(viewModel.pushActionLabel).toBeNull();
    expect(viewModel.statusTone).toBe("muted");
    expect(viewModel.statusMessage).toBe(
      "Select a repository worktree to inspect its git state here.",
    );
    expect(viewModel.sections).toEqual([]);
  });

  it("shows a folder-backed workspace as not being a git repository", () => {
    const viewModel = buildGitPanelViewModel({
      worktree: null,
      repositoryStatus: null,
      repositoryPath: "/tmp/folder-workspace",
      shellGit: createShellGitSnapshot({
        status: "not_repo",
        rootPath: undefined,
        branch: undefined,
        commit: undefined,
        hasChanges: undefined,
        ahead: undefined,
        behind: undefined,
        stagedCount: undefined,
        modifiedCount: undefined,
        untrackedCount: undefined,
        message: null,
      }),
    });

    expect(viewModel.branchLabel).toBe("Not a git repository");
    expect(viewModel.commitLabel).toBe("No commit");
    expect(viewModel.summary).toBe("Open folder only");
    expect(viewModel.syncLabel).toBe("Git unavailable");
    expect(viewModel.commitActionLabel).toBeNull();
    expect(viewModel.pullActionLabel).toBeNull();
    expect(viewModel.pushActionLabel).toBeNull();
    expect(viewModel.statusTone).toBe("muted");
    expect(viewModel.statusMessage).toBe(
      "This folder is open, but it is not a git repository.",
    );
    expect(viewModel.sections).toEqual([
      {
        title: "Workspace",
        rows: [{ label: "Path", value: "/tmp/folder-workspace" }],
      },
    ]);
  });

  it("keeps detached worktrees explicit in the summary", () => {
    const viewModel = buildGitPanelViewModel({
      worktree: createWorktree({
        label: "Detached",
        isDetached: true,
        git: createGitSnapshot({
          branch: null,
          commit: "deadbee",
          hasChanges: true,
          modifiedCount: 1,
        }),
      }),
      repositoryStatus: createRepositoryStatus({
        branch: null,
        upstreamBranch: null,
        unstagedChanges: [
          {
            path: "src/index.ts",
            status: "modified",
            indexStatus: null,
            worktreeStatus: "modified",
          },
        ],
      }),
    });

    expect(viewModel.branchLabel).toBe("Detached HEAD");
    expect(viewModel.summary).toBe("1 modified");
    expect(viewModel.statusTone).toBe("warning");
    expect(viewModel.statusMessage).toBe("Working tree has local changes.");
  });

  it("surfaces staged and unstaged counts from native repository status", () => {
    const viewModel = buildGitPanelViewModel({
      worktree: createWorktree({
        git: createGitSnapshot({
          hasChanges: true,
          stagedCount: 2,
          modifiedCount: 1,
          untrackedCount: 1,
        }),
      }),
      repositoryStatus: createRepositoryStatus({
        stagedChanges: [
          {
            path: "src/a.ts",
            status: "modified",
            indexStatus: "modified",
            worktreeStatus: null,
          },
          {
            path: "src/b.ts",
            status: "added",
            indexStatus: "added",
            worktreeStatus: null,
          },
        ],
        unstagedChanges: [
          {
            path: "src/c.ts",
            status: "modified",
            indexStatus: null,
            worktreeStatus: "modified",
          },
          {
            path: "src/d.ts",
            status: "untracked",
            indexStatus: null,
            worktreeStatus: "untracked",
          },
        ],
      }),
    });

    expect(viewModel.sections).toContainEqual({
      title: "Native Git",
      rows: [
        { label: "Staged files", value: "2" },
        { label: "Unstaged files", value: "2" },
        { label: "Conflicts", value: "0" },
      ],
    });
  });
});
