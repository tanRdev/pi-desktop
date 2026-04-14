import type { RepositorySnapshot } from "@pidesk/shared";
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
        onCreateThread={vi.fn(async () => "thread-new")}
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
    const onSelectThread = vi.fn();
    const onCreateThread = vi.fn(async () => "thread-new");
    const onAddRepository = vi.fn();

    renderLeftRail({
      onSelectThread,
      onCreateThread,
      onAddRepository,
    });

    expect(screen.getByTestId("left-rail")).toHaveAttribute(
      "data-mode",
      "workspace",
    );
    expect(screen.getByText("Alpha Workspace")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByTestId("thread-inline-input")).not.toBeInTheDocument();

    await user.click(screen.getByText("Active thread"));
    await user.click(screen.getByTestId("create-thread-button"));
    await user.click(screen.getByRole("button", { name: "New workspace" }));

    expect(onSelectThread).toHaveBeenCalledWith("thread-active");
    expect(onCreateThread).toHaveBeenCalledWith("worktree-1");
    expect(onAddRepository).toHaveBeenCalledTimes(1);
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
