// @vitest-environment jsdom
import type { RepositorySnapshot } from "@pi-desktop/shared";
import { TooltipProvider } from "@pi-desktop/ui";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeftSidebarWorkspacesPanel } from "./left-sidebar-workspaces-panel";

function createRepository(): RepositorySnapshot {
  return {
    id: "repo-1",
    name: "Alpha Workspace",
    customName: null,
    icon: null,
    accentColor: null,
    rootPath: "/tmp/alpha-workspace",
    defaultBranch: "main",
    worktrees: [
      {
        id: "worktree-1",
        label: "main",
        path: "/tmp/alpha-workspace",
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
        threads: [
          {
            id: "thread-active",
            title: "Active thread",
            lastActivityAt: 1,
            runtime: {
              status: "ready",
              lastError: null,
            },
          },
          {
            id: "thread-history",
            title: "History thread",
            lastActivityAt: 2,
            runtime: {
              status: "ready",
              lastError: null,
            },
          },
        ],
      },
      {
        id: "worktree-2",
        label: "feature/session-tabs",
        path: "/tmp/alpha-workspace-feature",
        isMain: false,
        isDetached: false,
        git: {
          status: "ready",
          branch: "feature/session-tabs",
          commit: "def456",
          hasChanges: false,
          ahead: 0,
          behind: 0,
          stagedCount: 0,
          modifiedCount: 0,
          untrackedCount: 0,
          message: null,
        },
        threads: [
          {
            id: "thread-feature",
            title: "Feature thread",
            lastActivityAt: 3,
            runtime: {
              status: "ready",
              lastError: null,
            },
          },
        ],
      },
    ],
  };
}

function renderWorkspacesPanel(
  overrides: Partial<ComponentProps<typeof LeftSidebarWorkspacesPanel>> = {},
) {
  return render(
    <TooltipProvider>
      <LeftSidebarWorkspacesPanel
        repositories={[createRepository()]}
        activeRepositoryId="repo-1"
        activeWorktreeId="worktree-1"
        activeThreadId="thread-active"
        expandedRepositoryIds={new Set(["repo-1"])}
        isCreatingSession={false}
        onSelectRepository={vi.fn()}
        onSelectWorktree={vi.fn()}
        onSelectThread={vi.fn()}
        onCreateSession={vi.fn()}
        onRepositoryContextMenu={vi.fn()}
        onWorktreeContextMenu={vi.fn()}
        onThreadContextMenu={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("LeftSidebarWorkspacesPanel", () => {
  it("renders the expanded repository tree and forwards row actions", async () => {
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();
    const onSelectWorktree = vi.fn();
    const onSelectThread = vi.fn();
    const onCreateSession = vi.fn();

    renderWorkspacesPanel({
      onSelectRepository,
      onSelectWorktree,
      onSelectThread,
      onCreateSession,
    });

    expect(screen.getByText("Alpha Workspace")).toBeInTheDocument();
    expect(screen.getAllByTestId("session-row")).toHaveLength(2);
    expect(screen.getAllByTestId("thread-row")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /Alpha Workspace/i }));
    await user.click(screen.getByText("feature/session-tabs"));
    await user.click(screen.getByText("History thread"));
    await user.click(screen.getByTestId("create-session-button"));

    expect(onSelectRepository).toHaveBeenCalledWith("repo-1");
    expect(onSelectWorktree).toHaveBeenCalledWith("worktree-2");
    expect(onSelectThread).toHaveBeenCalledWith("thread-history");
    expect(onCreateSession).toHaveBeenCalledTimes(1);
  });

  it("hides worktrees for collapsed repositories", () => {
    renderWorkspacesPanel({ expandedRepositoryIds: new Set() });

    expect(screen.queryAllByTestId("session-row")).toHaveLength(0);
    expect(screen.queryAllByTestId("thread-row")).toHaveLength(0);
  });
});
