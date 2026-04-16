import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TitleBar } from "./title-bar";

afterEach(() => {
  cleanup();
});

describe("TitleBar", () => {
  it("renders the terminal and side-panel controls for the workspace shell", async () => {
    const user = userEvent.setup();
    const onOpenTerminal = vi.fn();
    const onToggleRightSidebar = vi.fn();

    const { container } = render(
      <TitleBar
        platform="darwin"
        isTerminalActive={false}
        isRightSidebarVisible={false}
        onOpenTerminal={onOpenTerminal}
        onToggleRightSidebar={onToggleRightSidebar}
      />,
    );

    expect(container.firstElementChild).toHaveStyle({ paddingLeft: "16px" });
    expect(screen.getByTestId("titlebar-project-name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open terminal" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Toggle side panel" }),
    ).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Open terminal" }));
    await user.click(screen.getByRole("button", { name: "Toggle side panel" }));

    expect(onOpenTerminal).toHaveBeenCalledTimes(1);
    expect(onToggleRightSidebar).toHaveBeenCalledTimes(1);
  });

  it("keeps drag-region shell chrome styling", () => {
    const { container } = render(
      <TitleBar
        platform="darwin"
        isTerminalActive={false}
        isRightSidebarVisible
        onOpenTerminal={vi.fn()}
        onToggleRightSidebar={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-drag-region",
      "true",
    );
    expect(container.firstElementChild).toHaveClass("h-11");
    expect(container.firstElementChild).toHaveClass("border-b");
    expect(container.firstElementChild).toHaveClass("border-white/[0.03]");
    expect(
      screen.getByRole("button", { name: "Toggle side panel" }),
    ).toHaveClass("text-white/80");
  });
});
