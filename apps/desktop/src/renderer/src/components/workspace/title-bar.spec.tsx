import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TitleBar } from "./title-bar";

afterEach(() => {
  cleanup();
});

describe("TitleBar", () => {
  it("renders with correct traffic-light spacing on macOS", () => {
    const { container } = render(
      <TitleBar platform="darwin" hasActiveThread onAgentGitAction={vi.fn()} />,
    );

    expect(container.firstElementChild).toHaveStyle({ paddingLeft: "16px" });
    expect(screen.getByTestId("titlebar-project-name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Commit & Push/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "More git actions" }),
    ).toBeVisible();
  });

  it("invokes onAgentGitAction when clicking Commit & Push", async () => {
    const user = userEvent.setup();
    const onAgentGitAction = vi.fn();

    render(
      <TitleBar
        platform="darwin"
        hasActiveThread
        onAgentGitAction={onAgentGitAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Commit & Push/i }));
    expect(onAgentGitAction).toHaveBeenCalledTimes(1);
    expect(onAgentGitAction).toHaveBeenCalledWith(
      expect.stringContaining("push to origin"),
    );
  });

  it("disables the git split button when there is no active thread", () => {
    render(
      <TitleBar
        platform="darwin"
        hasActiveThread={false}
        onAgentGitAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Commit & Push/i }),
    ).toBeDisabled();
  });

  it("keeps drag-region shell chrome styling", () => {
    const { container } = render(<TitleBar platform="darwin" />);

    expect(container.firstElementChild).toHaveAttribute(
      "data-drag-region",
      "true",
    );
    expect(container.firstElementChild).toHaveClass("h-11");
    expect(container.firstElementChild).toHaveClass("border-b");
    expect(container.firstElementChild).toHaveClass("border-white/[0.03]");
  });
});
