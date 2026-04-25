// @vitest-environment jsdom
import { TooltipProvider } from "@pi-desktop/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  LeftSidebarAddWorkspaceButton,
  LeftSidebarTabs,
} from "./left-sidebar-chrome";

describe("LeftSidebarTabs", () => {
  it("renders the sidebar tab strip and switches tabs", async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();

    render(
      <LeftSidebarTabs activeTab="workspaces" onSelectTab={onSelectTab} />,
    );

    expect(
      screen.getByRole("tablist", { name: "Sidebar tabs" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-tab-workspaces")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("sidebar-tab-git")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByTestId("sidebar-tab-files")).toHaveAttribute(
      "aria-selected",
      "false",
    );

    await user.click(screen.getByRole("tab", { name: "Git" }));

    expect(onSelectTab).toHaveBeenCalledWith("git");
  });
});

describe("LeftSidebarAddWorkspaceButton", () => {
  it("keeps the add workspace CTA styling and forwards clicks", async () => {
    const user = userEvent.setup();
    const onAddWorkspace = vi.fn();

    render(
      <TooltipProvider>
        <LeftSidebarAddWorkspaceButton onAddWorkspace={onAddWorkspace} />
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Add workspace" });

    expect(button).toHaveClass("text-[11px]");
    expect(button).toHaveClass("uppercase");
    expect(button).toHaveClass("tracking-wider");
    expect(button).toHaveClass("font-medium");

    await user.click(button);

    expect(onAddWorkspace).toHaveBeenCalledTimes(1);
  });
});
