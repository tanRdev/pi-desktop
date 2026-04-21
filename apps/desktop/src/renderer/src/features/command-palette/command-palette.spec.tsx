// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./command-palette";
import {
  type Command,
  commandRegistry,
  registerCommand,
} from "./command-registry";

function clearRegistry() {
  commandRegistry.clear();
}

function makeCommand(overrides: Partial<Command>): Command {
  return {
    id: "noop",
    title: "Noop",
    run: () => undefined,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  clearRegistry();
});

describe("<CommandPalette />", () => {
  it("is not rendered when open=false", () => {
    render(<CommandPalette open={false} onOpenChange={() => undefined} />);
    expect(screen.queryByTestId("command-palette")).toBeNull();
  });

  it("opens and shows registered commands when open=true", async () => {
    registerCommand(
      makeCommand({ id: "toggle-sidebar", title: "Toggle Sidebar" }),
    );
    registerCommand(makeCommand({ id: "new-thread", title: "New Thread" }));

    render(<CommandPalette open onOpenChange={() => undefined} />);

    expect(await screen.findByTestId("command-palette")).toBeInTheDocument();
    expect(
      screen.getByTestId("command-row-toggle-sidebar"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("command-row-new-thread")).toBeInTheDocument();
  });

  it("filters commands by query using fuzzy search", async () => {
    registerCommand(
      makeCommand({ id: "toggle-sidebar", title: "Toggle Sidebar" }),
    );
    registerCommand(makeCommand({ id: "new-thread", title: "New Thread" }));
    registerCommand(makeCommand({ id: "reload", title: "Reload Window" }));

    render(<CommandPalette open onOpenChange={() => undefined} />);
    const input = await screen.findByTestId("command-palette-input");

    fireEvent.change(input, { target: { value: "thr" } });

    await waitFor(() => {
      expect(
        screen.queryByTestId("command-row-new-thread"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("command-row-toggle-sidebar")).toBeNull();
    expect(screen.queryByTestId("command-row-reload")).toBeNull();
  });

  it("shows empty state when nothing matches", async () => {
    registerCommand(makeCommand({ id: "one", title: "Apple" }));
    render(<CommandPalette open onOpenChange={() => undefined} />);
    const input = await screen.findByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "zzzz" } });
    expect(
      await screen.findByTestId("command-palette-empty"),
    ).toBeInTheDocument();
  });

  it("navigates with arrow keys and selects with Enter", async () => {
    const first = vi.fn();
    const second = vi.fn();
    registerCommand(makeCommand({ id: "a", title: "Alpha", run: first }));
    registerCommand(makeCommand({ id: "b", title: "Beta", run: second }));

    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} />);

    const input = await screen.findByTestId("command-palette-input");
    // First item selected by default.
    await waitFor(() => {
      const row = screen.getByTestId("command-row-a");
      expect(row.getAttribute("data-selected")).toBe("true");
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => {
      const row = screen.getByTestId("command-row-b");
      expect(row.getAttribute("data-selected")).toBe("true");
    });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("wraps selection when ArrowUp at top", async () => {
    registerCommand(makeCommand({ id: "a", title: "Alpha" }));
    registerCommand(makeCommand({ id: "b", title: "Beta" }));
    render(<CommandPalette open onOpenChange={() => undefined} />);
    const input = await screen.findByTestId("command-palette-input");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    await waitFor(() => {
      const row = screen.getByTestId("command-row-b");
      expect(row.getAttribute("data-selected")).toBe("true");
    });
  });

  it("closes on Escape", async () => {
    registerCommand(makeCommand({ id: "a", title: "Alpha" }));
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} />);
    const input = await screen.findByTestId("command-palette-input");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("invokes run with modifier=true when Cmd/Ctrl is held on Enter", async () => {
    const run = vi.fn();
    registerCommand(makeCommand({ id: "a", title: "Alpha", run }));
    render(<CommandPalette open onOpenChange={() => undefined} />);
    const input = await screen.findByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "Alpha" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    expect(run).toHaveBeenCalledTimes(1);
    const firstCall = run.mock.calls[0] ?? [];
    const ctx = firstCall[0];
    expect(ctx.modifier).toBe(true);
  });

  it("supports keepOpen() to stay open after run", async () => {
    const onOpenChange = vi.fn();
    registerCommand(
      makeCommand({
        id: "a",
        title: "Alpha",
        run: (ctx) => {
          ctx.keepOpen();
        },
      }),
    );
    render(<CommandPalette open onOpenChange={onOpenChange} />);
    const input = await screen.findByTestId("command-palette-input");
    fireEvent.keyDown(input, { key: "Enter" });
    // Should not have been asked to close.
    await act(async () => undefined);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("reflects live registry updates while open", async () => {
    render(<CommandPalette open onOpenChange={() => undefined} />);

    act(() => {
      registerCommand(makeCommand({ id: "a", title: "Alpha" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
  });
});
