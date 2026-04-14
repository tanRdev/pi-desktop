import type {
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitPanel } from "./git-panel";

function createWorktree(): WorktreeSnapshot {
  return {
    id: "worktree-1",
    label: "main",
    path: "/tmp/pi-desktop",
    isMain: true,
    isDetached: false,
    git: {
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
    },
    threads: [],
  };
}

function createRepositoryStatus(): GitRepositoryStatus {
  return {
    repositoryPath: "/tmp/pi-desktop",
    branch: "main",
    commit: "abc1234",
    upstreamBranch: "origin/main",
    summary: createWorktree().git,
    stagedChanges: [],
    unstagedChanges: [],
    conflictedChanges: [],
  };
}

function createShellGit(): ShellGitSnapshot {
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
  };
}

afterEach(() => {
  cleanup();
});

describe("GitPanel", () => {
  it("renders no empty change-list placeholder when repository has no file changes", () => {
    render(
      <GitPanel
        projectName="Pi"
        repositoryPath="/tmp/pi-desktop"
        worktree={createWorktree()}
        repositoryStatus={createRepositoryStatus()}
        shellGit={createShellGit()}
        commitMessage=""
        onCommitMessageChange={vi.fn()}
        onRefresh={vi.fn()}
        onCommit={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        onStageFile={vi.fn()}
        onUnstageFile={vi.fn()}
        onDiscardFile={vi.fn()}
      />,
    );

    expect(screen.queryByText("No changes detected")).not.toBeInTheDocument();
    expect(screen.queryByText("Changes")).not.toBeInTheDocument();
  });
});
