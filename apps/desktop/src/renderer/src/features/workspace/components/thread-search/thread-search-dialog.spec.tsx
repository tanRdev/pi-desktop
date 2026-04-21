// @vitest-environment jsdom
import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchableMessage } from "./search-engine";
import { ThreadSearchDialog } from "./thread-search-dialog";

function msg(
  id: string,
  text: string,
  overrides: Partial<AgentMessageSnapshot> = {},
): AgentMessageSnapshot {
  return {
    id,
    role: "user",
    text,
    status: "complete",
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

function pool(): SearchableMessage[] {
  return [
    {
      threadId: "t1",
      threadTitle: "Thread One",
      message: msg("m1", "hello world alpha"),
    },
    {
      threadId: "t1",
      threadTitle: "Thread One",
      message: msg("m2", "needle in a haystack", { role: "assistant" }),
    },
    {
      threadId: "t2",
      threadTitle: "Thread Two",
      message: msg("m3", "another needle hit here"),
    },
  ];
}

afterEach(() => {
  cleanup();
});

describe("<ThreadSearchDialog />", () => {
  it("is not rendered when closed", () => {
    render(
      <ThreadSearchDialog
        open={false}
        onOpenChange={() => undefined}
        messages={pool()}
        onSelect={() => undefined}
      />,
    );
    expect(screen.queryByTestId("thread-search-dialog")).toBeNull();
  });

  it("renders with a hint when open and query is empty", async () => {
    render(
      <ThreadSearchDialog
        open
        onOpenChange={() => undefined}
        messages={pool()}
        onSelect={() => undefined}
      />,
    );
    expect(
      await screen.findByTestId("thread-search-dialog"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("thread-search-hint")).toBeInTheDocument();
  });

  it("filters results as the user types", async () => {
    render(
      <ThreadSearchDialog
        open
        onOpenChange={() => undefined}
        messages={pool()}
        onSelect={() => undefined}
      />,
    );

    const input = await screen.findByTestId("thread-search-input");
    fireEvent.change(input, { target: { value: "needle" } });

    await waitFor(() => {
      expect(screen.queryByTestId("thread-search-row-m2")).toBeInTheDocument();
      expect(screen.queryByTestId("thread-search-row-m3")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("thread-search-row-m1")).toBeNull();
  });

  it("shows the empty state when nothing matches", async () => {
    render(
      <ThreadSearchDialog
        open
        onOpenChange={() => undefined}
        messages={pool()}
        onSelect={() => undefined}
      />,
    );
    const input = await screen.findByTestId("thread-search-input");
    fireEvent.change(input, { target: { value: "zzzznoresult" } });
    expect(
      await screen.findByTestId("thread-search-empty"),
    ).toBeInTheDocument();
  });

  it("selects the first result by default, then navigates with ArrowDown", async () => {
    render(
      <ThreadSearchDialog
        open
        onOpenChange={() => undefined}
        messages={pool()}
        onSelect={() => undefined}
      />,
    );
    const input = await screen.findByTestId("thread-search-input");
    fireEvent.change(input, { target: { value: "needle" } });

    // Wait for results to render.
    await waitFor(() =>
      expect(screen.queryByTestId("thread-search-row-m2")).toBeInTheDocument(),
    );

    const firstSelected = screen
      .getAllByTestId(/^thread-search-row-/)
      .find((el) => el.getAttribute("data-selected") === "true");
    expect(firstSelected).toBeDefined();

    fireEvent.keyDown(input, { key: "ArrowDown" });

    await waitFor(() => {
      const rows = screen.getAllByTestId(/^thread-search-row-/);
      const selected = rows.find(
        (el) => el.getAttribute("data-selected") === "true",
      );
      expect(selected).toBeDefined();
      // The selected row should have moved to a different row.
      expect(selected?.getAttribute("data-testid")).not.toBe(
        firstSelected?.getAttribute("data-testid"),
      );
    });
  });

  it("calls onSelect and closes when a result is clicked", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ThreadSearchDialog
        open
        onOpenChange={onOpenChange}
        messages={pool()}
        onSelect={onSelect}
      />,
    );

    const input = await screen.findByTestId("thread-search-input");
    fireEvent.change(input, { target: { value: "needle" } });

    const row = await screen.findByTestId("thread-search-row-m3");
    fireEvent.click(row);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const firstCall = onSelect.mock.calls[0] ?? [];
    const selected = firstCall[0];
    expect(selected.messageId).toBe("m3");
    expect(selected.threadId).toBe("t2");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onSelect and closes when Enter is pressed", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ThreadSearchDialog
        open
        onOpenChange={onOpenChange}
        messages={pool()}
        onSelect={onSelect}
      />,
    );

    const input = await screen.findByTestId("thread-search-input");
    fireEvent.change(input, { target: { value: "needle" } });

    await waitFor(() =>
      expect(screen.queryByTestId("thread-search-row-m2")).toBeInTheDocument(),
    );

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <ThreadSearchDialog
        open
        onOpenChange={onOpenChange}
        messages={pool()}
        onSelect={() => undefined}
      />,
    );

    const input = await screen.findByTestId("thread-search-input");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("wraps selection with ArrowUp at the top", async () => {
    render(
      <ThreadSearchDialog
        open
        onOpenChange={() => undefined}
        messages={pool()}
        onSelect={() => undefined}
      />,
    );
    const input = await screen.findByTestId("thread-search-input");
    fireEvent.change(input, { target: { value: "needle" } });

    await waitFor(() =>
      expect(screen.queryByTestId("thread-search-row-m2")).toBeInTheDocument(),
    );

    fireEvent.keyDown(input, { key: "ArrowUp" });

    await waitFor(() => {
      const rows = screen.getAllByTestId(/^thread-search-row-/);
      const selected = rows.find(
        (el) => el.getAttribute("data-selected") === "true",
      );
      // Should wrap to the last row.
      expect(selected).toBeDefined();
      expect(rows[rows.length - 1]).toBe(selected);
    });
  });

  it("renders a result count in the footer", async () => {
    render(
      <ThreadSearchDialog
        open
        onOpenChange={() => undefined}
        messages={pool()}
        onSelect={() => undefined}
      />,
    );
    const input = await screen.findByTestId("thread-search-input");
    fireEvent.change(input, { target: { value: "needle" } });
    await waitFor(() => {
      expect(screen.getByTestId("thread-search-count").textContent).toContain(
        "2",
      );
    });
  });
});
