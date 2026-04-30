// @vitest-environment jsdom
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

  it("labels the refresh control as a local status refresh and calls onRefresh", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    renderGitPanel({ onRefresh });

    const refreshButton = screen.getByRole("button", {
      name: "Refresh local Git status",
    });
    expect(refreshButton).toHaveAttribute("title", "Refresh local Git status");

    await user.click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
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

  it("applies a commit template and calls onCommitMessageChange", async () => {
    const user = userEvent.setup();
    const onCommitMessageChange = vi.fn();

    renderGitPanel({ onCommitMessageChange, commitMessage: "" });

    await user.click(
      screen.getByRole("button", { name: "Insert commit template" }),
    );
    // "feat" is the first default template label.
    const item = await screen.findByRole("button", { name: "feat" });
    await user.click(item);

    expect(onCommitMessageChange).toHaveBeenCalledTimes(1);
    expect(onCommitMessageChange).toHaveBeenCalledWith(
      expect.stringContaining("feat:"),
    );
  });

  it("shows amend toggle only when capability is enabled and fires onAmendChange", async () => {
    const user = userEvent.setup();
    const onAmendChange = vi.fn();

    // No amend capability → no toggle.
    const { unmount } = renderGitPanel();
    expect(
      screen.queryByRole("checkbox", { name: "Amend previous commit" }),
    ).not.toBeInTheDocument();
    unmount();

    renderGitPanel({
      capabilities: {
        amend: true,
        revertFile: false,
        listBranches: false,
        switchBranch: false,
        listStashes: false,
      },
      onAmendChange,
    });

    const checkbox = screen.getByRole("checkbox", {
      name: "Amend previous commit",
    });
    await user.click(checkbox);
    expect(onAmendChange).toHaveBeenCalledWith(true);
  });

  it("renders revert buttons only when revertFile capability is enabled", () => {
    const { unmount } = renderGitPanel();
    expect(
      screen.queryByRole("button", { name: "Revert src/needs-stage.ts" }),
    ).not.toBeInTheDocument();
    unmount();

    renderGitPanel({
      capabilities: {
        amend: false,
        revertFile: true,
        listBranches: false,
        switchBranch: false,
        listStashes: false,
      },
      onRevertFile: vi.fn(),
    });
    expect(
      screen.getByRole("button", { name: "Revert src/needs-stage.ts" }),
    ).toBeInTheDocument();
  });

  it("copies a file path to the clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    renderGitPanel();

    await user.click(
      screen.getByRole("button", { name: "Copy path src/needs-stage.ts" }),
    );

    expect(writeText).toHaveBeenCalledWith("src/needs-stage.ts");
  });

  it("moves focus with ArrowDown and toggles stage with Space", async () => {
    const user = userEvent.setup();
    const onStageFile = vi.fn();

    renderGitPanel({ onStageFile });

    const listbox = screen.getByRole("listbox", { name: "Changed files" });
    listbox.focus();

    // Initial focus is index 0 (first entry). Move down to an unstaged entry.
    await user.keyboard("{ArrowDown}");
    await user.keyboard(" ");

    expect(onStageFile).toHaveBeenCalledTimes(1);
    // Called with one of the unstaged paths.
    const callArg = onStageFile.mock.calls[0]?.[0];
    expect(["src/needs-stage.ts", "src/untracked.ts"]).toContain(callArg);
  });

  it("shows branch switcher only when listBranches capability is enabled", () => {
    const { unmount } = renderGitPanel({
      branches: [
        { name: "main", isCurrent: true, isRemote: false, upstream: null },
      ],
    });
    expect(
      screen.queryByRole("button", { name: "Switch branch" }),
    ).not.toBeInTheDocument();
    unmount();

    renderGitPanel({
      capabilities: {
        amend: false,
        revertFile: false,
        listBranches: true,
        switchBranch: true,
        listStashes: false,
      },
      branches: [
        { name: "main", isCurrent: true, isRemote: false, upstream: null },
        {
          name: "feature/x",
          isCurrent: false,
          isRemote: false,
          upstream: null,
        },
      ],
      onSwitchBranch: vi.fn(),
    });

    expect(
      screen.getByRole("button", { name: "Switch branch" }),
    ).toBeInTheDocument();
  });
});
