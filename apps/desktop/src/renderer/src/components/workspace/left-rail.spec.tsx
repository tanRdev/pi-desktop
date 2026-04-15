import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../ui/tooltip";
import { LeftRail } from "./left-rail";

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
            isArchived: false,
            lastActivityAt: 1,
            runtime: {
              status: "ready",
              lastError: null,
            },
          },
          {
            id: "thread-archived",
            title: "Archived thread",
            isArchived: true,
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
            isArchived: false,
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
            isArchived: false,
            lastActivityAt: 4,
            runtime: {
              status: "ready",
              lastError: null,
            },
          },
          {
            id: "beta-thread-archived",
            title: "Beta archived",
            isArchived: true,
            lastActivityAt: 5,
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

function renderLeftRail(
  overrides: Partial<ComponentProps<typeof LeftRail>> = {},
) {
  return render(
    <TooltipProvider>
      <LeftRail
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
        onArchiveSession={vi.fn()}
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

describe("LeftRail", () => {
  it("renders session groups and forwards primary rail actions", async () => {
    const user = userEvent.setup();
    const onSelectWorktree = vi.fn();
    const onSelectThread = vi.fn();
    const onCreateSession = vi.fn();
    const onAddRepository = vi.fn();

    renderLeftRail({
      onSelectWorktree,
      onSelectThread,
      onCreateSession,
      onAddRepository,
    });

    expect(screen.getByTestId("left-rail")).toHaveAttribute(
      "data-mode",
      "workspace",
    );
    expect(screen.getByText("Alpha Workspace")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("feature/session-tabs")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByText("Sessions")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("session-row")).toHaveLength(2);
    expect(screen.queryByText("Active thread")).not.toBeInTheDocument();

    await user.click(screen.getByText("feature/session-tabs"));
    await user.click(screen.getByTestId("create-session-button"));
    await user.click(screen.getByRole("button", { name: "New workspace" }));
    await user.click(screen.getByText("Archived thread"));

    expect(onSelectWorktree).toHaveBeenCalledWith("worktree-2");
    expect(onSelectThread).toHaveBeenCalledWith("thread-archived");
    expect(onCreateSession).toHaveBeenCalledTimes(1);
    expect(onAddRepository).toHaveBeenCalledTimes(1);
  });

  it("shows a hover archive action for session rows and forwards onArchiveSession", async () => {
    const user = userEvent.setup();
    const onArchiveSession = vi.fn();

    renderLeftRail({ onArchiveSession });

    const mainSessionRow = screen
      .getAllByTestId("session-row")
      .find((row) => within(row).queryByText("main"));
    if (!mainSessionRow) {
      throw new Error("Expected main session row");
    }

    await user.hover(mainSessionRow);

    const archiveButton = within(mainSessionRow).getByRole("button", {
      name: "Archive session main",
    });

    await user.click(archiveButton);

    expect(onArchiveSession).toHaveBeenCalledWith("worktree-1");
  });

  it("moves fully archived sessions into the archived section", () => {
    const repository = createRepository();
    const archivedSession = repository.worktrees.find(
      (worktree) => worktree.id === "worktree-2",
    );
    if (!archivedSession) {
      throw new Error("Expected archived session fixture");
    }

    archivedSession.threads = archivedSession.threads.map((thread) => ({
      ...thread,
      isArchived: true,
    }));

    renderLeftRail({
      repositories: [repository],
      activeWorktreeId: "worktree-1",
      activeThreadId: "thread-active",
    });

    // Only worktree-1 is active now (worktree-2 is fully archived)
    expect(screen.getAllByTestId("session-row")).toHaveLength(1);
    expect(screen.getAllByTestId("archived-session-row")).toHaveLength(1);
    expect(screen.getByTestId("archived-session-row")).toHaveTextContent(
      "feature/session-tabs",
    );
  });

  it("keeps current rail chrome classes for shell surface", () => {
    renderLeftRail();

    const rail = screen.getByTestId("left-rail");
    expect(rail).toHaveClass("bg-[var(--color-bg-primary)]");
    expect(rail).toHaveClass("border-r");
    expect(rail).toHaveClass("border-white/[0.06]");
  });

  it("toggles the active workspace open state when the workspace row is clicked", async () => {
    const user = userEvent.setup();

    renderLeftRail();

    const workspaceRow = screen.getByRole("button", {
      name: /Alpha Workspace/i,
    });

    // 2 active sessions + 1 archived thread = 3 visible (global archived always shows)
    expect(screen.getAllByTestId("session-row")).toHaveLength(2);
    expect(screen.getByText("Archived thread")).toBeInTheDocument();

    await user.click(workspaceRow);
    // Active sessions are hidden when collapsed, but archived is global and always visible
    expect(screen.queryAllByTestId("session-row")).toHaveLength(0);
    expect(screen.getByText("Archived thread")).toBeInTheDocument();

    await user.click(workspaceRow);
    expect(screen.getAllByTestId("session-row")).toHaveLength(2);
    expect(screen.getByText("Archived thread")).toBeInTheDocument();
  });

  it("expands only the active workspace and switches expansion when another project is selected", async () => {
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();

    const view = renderLeftRail({
      repositories: [createRepository(), createRepositoryTwo()],
      activeRepositoryId: "repo-2",
      activeWorktreeId: "beta-worktree-1",
      activeThreadId: "beta-thread-active",
      onSelectRepository,
    });

    expect(screen.getByText("Beta Workspace")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    // Archived is global - shows items from ALL workspaces
    expect(screen.getByText("Beta archived")).toBeInTheDocument();
    expect(screen.getByText("Archived thread")).toBeInTheDocument();
    expect(screen.queryByText("feature/session-tabs")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("session-row")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Alpha Workspace/i }));

    expect(onSelectRepository).toHaveBeenCalledWith("repo-1");

    view.rerender(
      <TooltipProvider>
        <LeftRail
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
          onArchiveSession={vi.fn()}
          onDeleteThread={vi.fn(async () => undefined)}
          onAddRepository={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("feature/session-tabs")).toBeInTheDocument();
    expect(screen.getByText("Archived thread")).toBeInTheDocument();
    // Archived is global - shows items from ALL workspaces, including Beta
    expect(screen.getByText("Beta archived")).toBeInTheDocument();
    expect(screen.getAllByTestId("session-row")).toHaveLength(2);

    const alphaWorkspaceRow = screen
      .getAllByTestId("workspace-row")
      .find((row) => within(row).queryByText("Alpha Workspace"));
    if (!alphaWorkspaceRow) {
      throw new Error("Expected Alpha Workspace row");
    }

    expect(alphaWorkspaceRow).toHaveTextContent("Alpha Workspace");
  });
});

describe("Archived thread deletion", () => {
  it("shows delete button on hover for archived thread", async () => {
    const user = userEvent.setup();
    renderLeftRail();

    const archivedThreadRow = screen
      .getByText("Archived thread")
      .closest("div");
    if (!archivedThreadRow) throw new Error("Archived thread row not found");

    await user.hover(archivedThreadRow);

    const deleteButton = screen.getByTestId("archived-thread-delete-button");
    expect(deleteButton).toBeInTheDocument();
  });

  it("shows tooltip hint for delete button", async () => {
    const user = userEvent.setup();
    renderLeftRail();

    const archivedThreadRow = screen
      .getByText("Archived thread")
      .closest("div");
    if (!archivedThreadRow) throw new Error("Archived thread row not found");

    await user.hover(archivedThreadRow);

    const deleteButton = screen.getByTestId("archived-thread-delete-button");
    expect(deleteButton).toHaveAttribute("title", "Delete archived thread");
  });

  it("hides delete button when onDeleteThread is not provided", async () => {
    const user = userEvent.setup();
    renderLeftRail({ onDeleteThread: undefined });

    const archivedThreadRow = screen
      .getByText("Archived thread")
      .closest("div");
    if (!archivedThreadRow) throw new Error("Archived thread row not found");

    await user.hover(archivedThreadRow);

    expect(
      screen.queryByTestId("archived-thread-delete-button"),
    ).not.toBeInTheDocument();
  });

  it("opens confirmation popover when trash icon is clicked", async () => {
    const user = userEvent.setup();
    renderLeftRail();

    const archivedThreadRow = screen
      .getByText("Archived thread")
      .closest("div");
    if (!archivedThreadRow) throw new Error("Archived thread row not found");

    await user.hover(archivedThreadRow);

    const deleteButton = screen.getByTestId("archived-thread-delete-button");
    await user.click(deleteButton);

    expect(
      screen.getByText("Permanently delete this archived thread?"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("archived-thread-delete-cancel"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("archived-thread-delete-confirm"),
    ).toBeInTheDocument();
  });

  it("calls onDeleteThread when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onDeleteThread = vi.fn(async () => undefined);
    renderLeftRail({ onDeleteThread });

    const archivedThreadRow = screen
      .getByText("Archived thread")
      .closest("div");
    if (!archivedThreadRow) throw new Error("Archived thread row not found");

    await user.hover(archivedThreadRow);

    await user.click(screen.getByTestId("archived-thread-delete-button"));
    await user.click(screen.getByTestId("archived-thread-delete-confirm"));

    expect(onDeleteThread).toHaveBeenCalledWith("thread-archived");
  });

  it("closes confirmation popover when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onDeleteThread = vi.fn(async () => undefined);
    renderLeftRail({ onDeleteThread });

    const archivedThreadRow = screen
      .getByText("Archived thread")
      .closest("div");
    if (!archivedThreadRow) throw new Error("Archived thread row not found");

    await user.hover(archivedThreadRow);

    await user.click(screen.getByTestId("archived-thread-delete-button"));
    await user.click(screen.getByTestId("archived-thread-delete-cancel"));

    expect(
      screen.queryByText("Permanently delete this archived thread?"),
    ).not.toBeInTheDocument();
    expect(onDeleteThread).not.toHaveBeenCalled();
  });
});
