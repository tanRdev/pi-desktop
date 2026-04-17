import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../ui/tooltip";
import { LeftSidebar, SIDEBAR_WIDTH } from "./left-sidebar";

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

function createRepositoryTwo(): RepositorySnapshot {
  return {
    id: "repo-2",
    name: "Beta Workspace",
    customName: null,
    icon: null,
    accentColor: null,
    rootPath: "/tmp/beta-workspace",
    defaultBranch: "main",
    worktrees: [
      {
        id: "beta-worktree-1",
        label: "main",
        path: "/tmp/beta-workspace",
        isMain: true,
        isDetached: false,
        git: {
          status: "ready",
          branch: "main",
          commit: "987abc",
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
            id: "beta-thread-active",
            title: "Beta thread",
            lastActivityAt: 4,
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

function renderLeftSidebar(
  overrides: Partial<ComponentProps<typeof LeftSidebar>> = {},
) {
  return render(
    <TooltipProvider>
      <LeftSidebar
        repositories={[createRepository()]}
        activeRepositoryId="repo-1"
        activeWorktreeId="worktree-1"
        activeThreadId="thread-active"
        width={240}
        onResize={vi.fn()}
        onSelectRepository={vi.fn()}
        onSelectWorktree={vi.fn()}
        onSelectThread={vi.fn()}
        onCreateSession={vi.fn()}
        onDeleteThread={vi.fn(async () => undefined)}
        onAddRepository={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("LeftSidebar", () => {
  it("renders session groups and forwards primary rail actions", async () => {
    const user = userEvent.setup();
    const onSelectWorktree = vi.fn();
    const onSelectThread = vi.fn();
    const onCreateSession = vi.fn();
    const onAddRepository = vi.fn();

    renderLeftSidebar({
      onSelectWorktree,
      onSelectThread,
      onCreateSession,
      onAddRepository,
    });

    expect(screen.getByTestId("left-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Alpha Workspace")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("feature/session-tabs")).toBeInTheDocument();
    expect(screen.getAllByTestId("session-row")).toHaveLength(2);
    expect(screen.getAllByTestId("thread-row")).toHaveLength(3);
    expect(screen.getByText("Active thread")).toBeInTheDocument();
    expect(screen.getByText("History thread")).toBeInTheDocument();
    expect(screen.getByText("Feature thread")).toBeInTheDocument();

    await user.click(screen.getByText("feature/session-tabs"));
    await user.click(screen.getByText("History thread"));
    await user.click(screen.getByTestId("create-session-button"));
    await user.click(screen.getByRole("button", { name: "Add workspace" }));

    expect(onSelectWorktree).toHaveBeenCalledWith("worktree-2");
    expect(onSelectThread).toHaveBeenCalledWith("thread-history");
    expect(onCreateSession).toHaveBeenCalledTimes(1);
    expect(onAddRepository).toHaveBeenCalledTimes(1);
  });

  it("keeps current rail chrome classes for shell surface", () => {
    renderLeftSidebar();

    const rail = screen.getByTestId("left-sidebar");
    expect(rail).toHaveClass("bg-[var(--color-bg-primary)]");
    expect(rail).toHaveClass("border-r");
    expect(rail).toHaveClass("border-white/[0.06]");
  });

  it("uses the tab label typography for the Add workspace action", () => {
    renderLeftSidebar();

    const addWorkspaceButton = screen.getByRole("button", {
      name: "Add workspace",
    });

    expect(addWorkspaceButton).toHaveClass("text-[10px]");
    expect(addWorkspaceButton).toHaveClass("uppercase");
    expect(addWorkspaceButton).toHaveClass("tracking-wider");
    expect(addWorkspaceButton).toHaveClass("font-medium");
  });

  it("toggles the active workspace open state when the workspace row is clicked", async () => {
    const user = userEvent.setup();

    renderLeftSidebar();

    const workspaceRow = screen.getByRole("button", {
      name: /Alpha Workspace/i,
    });

    expect(screen.getAllByTestId("session-row")).toHaveLength(2);

    await user.click(workspaceRow);
    expect(screen.queryAllByTestId("session-row")).toHaveLength(0);

    await user.click(workspaceRow);
    expect(screen.getAllByTestId("session-row")).toHaveLength(2);
  });

  it("expands only the active workspace and switches expansion when another project is selected", async () => {
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();

    const view = renderLeftSidebar({
      repositories: [createRepository(), createRepositoryTwo()],
      activeRepositoryId: "repo-2",
      activeWorktreeId: "beta-worktree-1",
      activeThreadId: "beta-thread-active",
      onSelectRepository,
    });

    expect(screen.getByText("Beta Workspace")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.queryByText("feature/session-tabs")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("session-row")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Alpha Workspace/i }));

    expect(onSelectRepository).toHaveBeenCalledWith("repo-1");

    view.rerender(
      <TooltipProvider>
        <LeftSidebar
          repositories={[createRepository(), createRepositoryTwo()]}
          activeRepositoryId="repo-1"
          activeWorktreeId="worktree-1"
          activeThreadId="thread-active"
          width={240}
          onResize={vi.fn()}
          onSelectRepository={onSelectRepository}
          onSelectWorktree={vi.fn()}
          onSelectThread={vi.fn()}
          onCreateSession={vi.fn()}
          onDeleteThread={vi.fn(async () => undefined)}
          onAddRepository={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("feature/session-tabs")).toBeInTheDocument();
    expect(screen.getAllByTestId("session-row")).toHaveLength(2);

    const alphaWorkspaceRow = screen
      .getAllByTestId("workspace-row")
      .find((row) => within(row).queryByText("Alpha Workspace"));
    if (!alphaWorkspaceRow) {
      throw new Error("Expected Alpha Workspace row");
    }

    expect(alphaWorkspaceRow).toHaveTextContent("Alpha Workspace");
  });

  it("replaces the resize divider with hide and show sidebar controls", async () => {
    const user = userEvent.setup();
    const onResize = vi.fn();
    const view = renderLeftSidebar({ onResize });

    await user.click(screen.getByRole("button", { name: "Hide sidebar" }));

    expect(onResize).toHaveBeenCalledWith(0);

    view.rerender(
      <TooltipProvider>
        <LeftSidebar
          repositories={[createRepository()]}
          activeRepositoryId="repo-1"
          activeWorktreeId="worktree-1"
          activeThreadId="thread-active"
          width={0}
          onResize={onResize}
          onSelectRepository={vi.fn()}
          onSelectWorktree={vi.fn()}
          onSelectThread={vi.fn()}
          onCreateSession={vi.fn()}
          onDeleteThread={vi.fn(async () => undefined)}
          onAddRepository={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Hide sidebar" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show sidebar" }));

    expect(onResize).toHaveBeenLastCalledWith(240);
    expect(onResize).not.toHaveBeenCalledWith(SIDEBAR_WIDTH);
  });
});
