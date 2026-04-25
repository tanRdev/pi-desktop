// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceShellTerminalAside } from "./workspace-shell-terminal-aside";

const terminalPropsSpy = vi.fn();

vi.mock("@/components/ui/terminal", () => ({
  Terminal(props: { cwd?: string; onCommandComplete?: () => void }) {
    terminalPropsSpy(props);
    return (
      <button
        type="button"
        data-testid="terminal"
        onClick={() => props.onCommandComplete?.()}
      >
        Terminal
      </button>
    );
  },
}));

vi.mock("@/components/ui/phosphor-icons", () => ({
  X() {
    return <span data-testid="close-icon" />;
  },
}));

describe("WorkspaceShellTerminalAside", () => {
  afterEach(() => {
    cleanup();
    terminalPropsSpy.mockReset();
  });

  it("renders terminal chrome and propagates cwd and completion events", async () => {
    const user = userEvent.setup();
    const onToggleTerminal = vi.fn();
    const onTerminalCommandComplete = vi.fn();

    render(
      <WorkspaceShellTerminalAside
        workspacePath="/test/workspace"
        onToggleTerminal={onToggleTerminal}
        onTerminalCommandComplete={onTerminalCommandComplete}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Close terminal" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Close terminal" }),
    ).toBeVisible();
    expect(terminalPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/test/workspace",
        onCommandComplete: onTerminalCommandComplete,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Close terminal" }));
    await user.click(screen.getByTestId("terminal"));

    expect(onToggleTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminalCommandComplete).toHaveBeenCalledTimes(1);
  });

  it("omits cwd when the workspace path is unavailable", () => {
    render(
      <WorkspaceShellTerminalAside
        workspacePath={null}
        onToggleTerminal={vi.fn()}
        onTerminalCommandComplete={vi.fn()}
      />,
    );

    expect(terminalPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: undefined,
      }),
    );
  });
});
