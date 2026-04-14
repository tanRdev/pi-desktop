import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
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
        onSelectWorktree={vi.fn()}
        onSelectThread={vi.fn()}
        onCreateSession={vi.fn()}
        onCloseThread={vi.fn()}
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
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("feature/session-tabs")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("session-row").map((row) => row.textContent),
    ).toEqual(["main", "feature/session-tabs"]);
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

  it("keeps current rail chrome classes for shell surface", () => {
    renderLeftRail();

    const rail = screen.getByTestId("left-rail");
    expect(rail).toHaveClass("bg-[var(--color-bg-primary)]");
    expect(rail).toHaveClass("border-r");
    expect(rail).toHaveClass("border-white/[0.06]");
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
