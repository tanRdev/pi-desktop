import type {
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      hasChanges: true,
      ahead: 0,
      behind: 0,
      stagedCount: 1,
      modifiedCount: 1,
      untrackedCount: 1,
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
    stagedChanges: [
      {
        path: "src/already-staged.ts",
        status: "modified",
        indexStatus: "modified",
        worktreeStatus: null,
      },
    ],
    unstagedChanges: [
      {
        path: "src/needs-stage.ts",
        status: "modified",
        indexStatus: null,
        worktreeStatus: "modified",
      },
      {
        path: "src/untracked.ts",
        status: "untracked",
        indexStatus: null,
        worktreeStatus: "untracked",
      },
    ],
    conflictedChanges: [],
  };
}

function createShellGit(): ShellGitSnapshot {
  return {
    status: "repository",
    rootPath: "/tmp/pi-desktop",
    branch: "main",
    commit: "abc1234",
    hasChanges: true,
    ahead: 0,
    behind: 0,
    stagedCount: 1,
    modifiedCount: 1,
    untrackedCount: 1,
    message: null,
  };
}

function renderGitPanel(
  overrides: Partial<React.ComponentProps<typeof GitPanel>> &
    Record<string, unknown> = {},
) {
  const props = {
    projectName: "Pi",
    repositoryPath: "/tmp/pi-desktop",
    worktree: createWorktree(),
    repositoryStatus: createRepositoryStatus(),
    shellGit: createShellGit(),
    commitMessage: "",
    onCommitMessageChange: vi.fn(),
    onRefresh: vi.fn(),
    onCommit: vi.fn(),
    onCommitAndPush: vi.fn(),
    onPull: vi.fn(),
    onPush: vi.fn(),
    onFetch: vi.fn(),
    onStageFile: vi.fn(),
    onStageAllFiles: vi.fn(),
    onUnstageFile: vi.fn(),
    onUnstageAllFiles: vi.fn(),
    onDiscardFile: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<GitPanel {...props} />),
    props,
  };
}

afterEach(() => {
  cleanup();
});

describe("GitPanel", () => {
  it("renders bulk stage and unstage controls when file changes exist", () => {
    renderGitPanel();

    expect(
      screen.getByRole("button", { name: "Select all" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Deselect all" }),
    ).toBeInTheDocument();
  });

  it("calls one bulk stage handler when select all is pressed", async () => {
    const user = userEvent.setup();
    const onStageAllFiles = vi.fn();

    const { props } = renderGitPanel({ onStageAllFiles });

    await user.click(screen.getByRole("button", { name: "Select all" }));

    expect(onStageAllFiles).toHaveBeenCalledTimes(1);
    expect(onStageAllFiles).toHaveBeenCalledWith([
      "src/needs-stage.ts",
      "src/untracked.ts",
    ]);
    expect(props.onStageFile).not.toHaveBeenCalled();
  });

  it("calls one bulk unstage handler when deselect all is pressed", async () => {
    const user = userEvent.setup();
    const onUnstageAllFiles = vi.fn();

    const { props } = renderGitPanel({ onUnstageAllFiles });

    await user.click(screen.getByRole("button", { name: "Deselect all" }));

    expect(onUnstageAllFiles).toHaveBeenCalledTimes(1);
    expect(onUnstageAllFiles).toHaveBeenCalledWith(["src/already-staged.ts"]);
    expect(props.onUnstageFile).not.toHaveBeenCalled();
  });

  it("does not render bulk controls when there are no file changes", () => {
    renderGitPanel({
      repositoryStatus: {
        ...createRepositoryStatus(),
        stagedChanges: [],
        unstagedChanges: [],
      },
    });

    expect(
      screen.queryByRole("button", { name: "Select all" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Deselect all" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Changes")).not.toBeInTheDocument();
  });

  it("keeps row-level toggles working for individual files", async () => {
    const user = userEvent.setup();
    const onStageFile = vi.fn();
    const onUnstageFile = vi.fn();

    renderGitPanel({ onStageFile, onUnstageFile });

    const unstagedToggle = screen.getByRole("button", {
      name: "Stage src/needs-stage.ts",
    });
    const stagedToggle = screen.getByRole("button", {
      name: "Unstage src/already-staged.ts",
    });

    await user.click(unstagedToggle);
    await user.click(stagedToggle);

    expect(onStageFile).toHaveBeenCalledWith("src/needs-stage.ts");
    expect(onUnstageFile).toHaveBeenCalledWith("src/already-staged.ts");
  });
});
