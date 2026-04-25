// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

const gitPanelHeaderMock = vi.fn<(props: unknown) => React.JSX.Element>(() => (
  <div data-testid="git-panel-header-seam" />
));

vi.mock("./git-panel-header", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./git-panel-header")>();

  return {
    ...actual,
    GitPanelHeader: (props: unknown) => {
      gitPanelHeaderMock(props);
      return <div data-testid="git-panel-header-seam" />;
    },
  };
});

import { GitPanel } from "./git-panel";

describe("GitPanel header seam", () => {
  it("delegates branch and sync summary rendering to the dedicated header component", () => {
    render(
      <GitPanel
        projectName="Pi"
        repositoryPath="/tmp/pi-desktop"
        worktree={{
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
            ahead: 1,
            behind: 0,
            stagedCount: 1,
            modifiedCount: 1,
            untrackedCount: 1,
            message: null,
          },
          threads: [],
        }}
        repositoryStatus={{
          repositoryPath: "/tmp/pi-desktop",
          branch: "main",
          commit: "abc1234",
          upstreamBranch: "origin/main",
          summary: {
            status: "ready",
            branch: "main",
            commit: "abc1234",
            hasChanges: true,
            ahead: 1,
            behind: 0,
            stagedCount: 1,
            modifiedCount: 1,
            untrackedCount: 1,
            message: null,
          },
          stagedChanges: [],
          unstagedChanges: [],
          conflictedChanges: [],
        }}
        shellGit={{
          status: "repository",
          rootPath: "/tmp/pi-desktop",
          branch: "main",
          commit: "abc1234",
          hasChanges: true,
          ahead: 1,
          behind: 0,
          stagedCount: 1,
          modifiedCount: 1,
          untrackedCount: 1,
          message: null,
        }}
        commitMessage=""
        onCommitMessageChange={vi.fn()}
        onRefresh={vi.fn()}
        onCommit={vi.fn()}
        onCommitAndPush={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        onFetch={vi.fn()}
        onStageFile={vi.fn()}
        onStageAllFiles={vi.fn()}
        onUnstageFile={vi.fn()}
        onUnstageAllFiles={vi.fn()}
        onDiscardFile={vi.fn()}
      />,
    );

    expect(screen.getByTestId("git-panel-header-seam")).toBeInTheDocument();
    expect(gitPanelHeaderMock).toHaveBeenCalledOnce();
  });
});
