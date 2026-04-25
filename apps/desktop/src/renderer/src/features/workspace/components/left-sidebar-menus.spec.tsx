// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  LeftSidebarItemMenu,
  LeftSidebarRepositoryMenu,
} from "./left-sidebar-menus";

describe("LeftSidebarRepositoryMenu", () => {
  it("renders repository actions and forwards the repository id", async () => {
    const user = userEvent.setup();
    const onCopyPath = vi.fn();
    const onOpenInFinder = vi.fn();
    const onRemoveRepository = vi.fn();

    render(
      <LeftSidebarRepositoryMenu
        menu={{
          isOpen: true,
          x: 120,
          y: 240,
          repositoryId: "repo-1",
          repositoryName: "Alpha Workspace",
        }}
        menuRef={{ current: null }}
        onCopyPath={onCopyPath}
        onOpenInFinder={onOpenInFinder}
        onRemoveRepository={onRemoveRepository}
      />,
    );

    expect(screen.getByText("Alpha Workspace")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy path" }));
    await user.click(screen.getByRole("button", { name: "Open in Finder" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(onCopyPath).toHaveBeenCalledWith("repo-1");
    expect(onOpenInFinder).toHaveBeenCalledWith("repo-1");
    expect(onRemoveRepository).toHaveBeenCalledWith("repo-1");
  });
});

describe("LeftSidebarItemMenu", () => {
  it("renders delete confirmation copy and forwards confirm and cancel actions", async () => {
    const user = userEvent.setup();
    const onConfirmAction = vi.fn();
    const onClearConfirmation = vi.fn();

    render(
      <LeftSidebarItemMenu
        menu={{
          isOpen: true,
          x: 80,
          y: 160,
          type: "thread",
          id: "thread-1",
          label: "Signal",
          confirming: "delete",
        }}
        menuRef={{ current: null }}
        onConfirmAction={onConfirmAction}
        onClearConfirmation={onClearConfirmation}
      />,
    );

    expect(
      screen.getByText("Delete this thread? This cannot be undone."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirmAction).toHaveBeenCalledWith("delete");
    expect(onClearConfirmation).toHaveBeenCalledTimes(1);
  });
});
