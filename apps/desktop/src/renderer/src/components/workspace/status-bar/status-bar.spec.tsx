// @vitest-environment jsdom
import type { GitRepositoryStatus } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatusBar } from "./status-bar";

afterEach(() => {
  cleanup();
});

function makeGitStatus(
  overrides: Partial<GitRepositoryStatus> = {},
): GitRepositoryStatus {
  return {
    repositoryPath: "/repo",
    branch: "main",
    commit: "abc1234",
    upstreamBranch: "origin/main",
    summary: {
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
    stagedChanges: [],
    unstagedChanges: [],
    conflictedChanges: [],
    ...overrides,
  };
}

describe("StatusBar", () => {
  it("renders without crashing when no data is supplied", () => {
    render(<StatusBar />);

    const bar = screen.getByTestId("status-bar");
    expect(bar).toBeInTheDocument();
    // Settings is always present.
    expect(screen.getByTestId("status-bar-settings")).toBeInTheDocument();
    // Branch cell hides when no branch info is present.
    expect(screen.queryByTestId("status-bar-branch")).toBeNull();
    // Changes cell hides when no changes exist.
    expect(screen.queryByTestId("status-bar-changes")).toBeNull();
  });

  it("shows the branch label when git status is present", () => {
    render(<StatusBar gitStatus={makeGitStatus({ branch: "feature/foo" })} />);

    const branch = screen.getByTestId("status-bar-branch");
    expect(branch).toHaveTextContent("feature/foo");
  });

  it("falls back to the shell git branch when repository status is missing", () => {
    render(
      <StatusBar shellGit={{ status: "repository", branch: "shell-branch" }} />,
    );

    expect(screen.getByTestId("status-bar-branch")).toHaveTextContent(
      "shell-branch",
    );
  });

  it("renders staged/unstaged counts when there are changes", () => {
    const status = makeGitStatus({
      stagedChanges: [
        {
          path: "a.ts",
          status: "modified",
          indexStatus: "modified",
          worktreeStatus: null,
        },
        {
          path: "b.ts",
          status: "modified",
          indexStatus: "modified",
          worktreeStatus: null,
        },
      ],
      unstagedChanges: [
        {
          path: "c.ts",
          status: "modified",
          indexStatus: null,
          worktreeStatus: "modified",
        },
      ],
    });
    render(<StatusBar gitStatus={status} />);

    const changes = screen.getByTestId("status-bar-changes");
    expect(changes).toHaveTextContent("2");
    expect(changes).toHaveTextContent("1");
  });

  it("renders the active model placeholder when no value is supplied", () => {
    render(<StatusBar />);
    expect(screen.getByTestId("status-bar-model")).toHaveTextContent("auto");
  });

  it("renders the supplied active model value", () => {
    render(<StatusBar currentModelValue="claude-opus-4" />);
    expect(screen.getByTestId("status-bar-model")).toHaveTextContent(
      "claude-opus-4",
    );
  });

  it("dispatches a pi:command 'open-settings' event when the cog is clicked", async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener("pi:command", listener);

    render(<StatusBar />);
    await user.click(screen.getByTestId("status-bar-settings"));

    window.removeEventListener("pi:command", listener);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    if (!(event instanceof CustomEvent))
      throw new Error("expected CustomEvent");
    expect(event.detail).toEqual({ commandId: "open-settings" });
  });
});
