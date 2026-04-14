import type { WorktreeSnapshot } from "@pidesk/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileTreeOverlay } from "./workspace-overlays";

vi.mock("../ui/file-tree", () => ({
  FileTree({
    rootPath,
    onFileClick,
  }: {
    rootPath: string;
    onFileClick: (path: string) => void | Promise<void>;
  }) {
    return (
      <button
        type="button"
        onClick={() => void onFileClick(`${rootPath}/src/index.ts`)}
      >
        Open file
      </button>
    );
  },
}));

function createWorktree(
  overrides: Partial<WorktreeSnapshot> = {},
): WorktreeSnapshot {
  return {
    id: "repo-main",
    label: "main",
    path: "/tmp/repo",
    isMain: true,
    isDetached: false,
    git: {
      status: "ready",
      branch: "main",
      commit: "abc123",
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: null,
    },
    threads: [],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("FileTreeOverlay", () => {
  it("shows the empty-state copy when no worktree is selected", () => {
    render(
      <FileTreeOverlay
        ariaLabel="File tree overlay"
        projectName="Pi Desktop"
        activeWorktree={null}
        onClose={vi.fn()}
        onFileClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "File tree overlay" }),
    ).toBeVisible();
    expect(
      screen.getByText("Select a worktree to browse files"),
    ).toBeInTheDocument();
  });

  it("closes the overlay after a file is selected", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onFileClick = vi.fn(async () => undefined);

    render(
      <FileTreeOverlay
        ariaLabel="File tree overlay"
        projectName="Pi Desktop"
        activeWorktree={createWorktree()}
        onClose={onClose}
        onFileClick={onFileClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open file" }));

    expect(onFileClick).toHaveBeenCalledWith("/tmp/repo/src/index.ts");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
