import { describe, expect, it } from "vitest";
import {
  buildGitPanelViewModel,
  formatGitCountsSummary,
} from "../../../apps/desktop/src/renderer/src/components/workspace/git-panel-model";
import type {
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
    });

    expect(viewModel.title).toBe("Git");
    expect(viewModel.branchLabel).toBe("release");
    expect(viewModel.commitLabel).toBe("7654321");
    expect(viewModel.summary).toBe("Clean");
    expect(viewModel.syncLabel).toBe("2 ahead, 1 behind");
    expect(viewModel.primaryActionLabel).toBe("Open lazygit");
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
    });

    expect(viewModel.branchLabel).toBe("Unavailable");
    expect(viewModel.commitLabel).toBe("No commit");
    expect(viewModel.summary).toBe("Git unavailable");
    expect(viewModel.syncLabel).toBe("No remote tracking");
    expect(viewModel.primaryActionLabel).toBeNull();
    expect(viewModel.statusTone).toBe("warning");
    expect(viewModel.statusMessage).toBe("Git CLI unavailable");
  });

  it("shows an empty selection state when no worktree is active", () => {
    const viewModel = buildGitPanelViewModel({
      worktree: null,
    });

    expect(viewModel.branchLabel).toBe("No worktree");
    expect(viewModel.commitLabel).toBe("No commit");
    expect(viewModel.summary).toBe("Select a worktree");
    expect(viewModel.syncLabel).toBe("Git data unavailable");
    expect(viewModel.primaryActionLabel).toBeNull();
    expect(viewModel.statusTone).toBe("muted");
    expect(viewModel.statusMessage).toBe(
      "Select a repository worktree to inspect its git state here.",
    );
    expect(viewModel.sections).toEqual([]);
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
    });

    expect(viewModel.branchLabel).toBe("Detached HEAD");
    expect(viewModel.summary).toBe("1 modified");
    expect(viewModel.statusTone).toBe("warning");
    expect(viewModel.statusMessage).toBe("Working tree has local changes.");
  });
});
