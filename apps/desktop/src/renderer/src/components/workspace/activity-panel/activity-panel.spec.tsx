// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createActivityLogStream } from "./activity-log-stream";
import { ActivityPanel } from "./activity-panel";

afterEach(() => {
  cleanup();
});

function makeEntry(
  ts: number,
  level: "info" | "warn" | "error" | "trace" | "debug",
  scope: string,
  message: string,
) {
  return { ts, level, scope, message };
}

describe("ActivityPanel", () => {
  it("renders nothing when closed", () => {
    const stream = createActivityLogStream();
    render(
      <ActivityPanel open={false} onOpenChange={() => {}} stream={stream} />,
    );
    expect(screen.queryByTestId("activity-drawer")).toBeNull();
  });

  it("renders empty state when open with no entries", () => {
    const stream = createActivityLogStream();
    render(
      <ActivityPanel open={true} onOpenChange={() => {}} stream={stream} />,
    );
    expect(screen.getByTestId("activity-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
  });

  it("renders entries", () => {
    const stream = createActivityLogStream();
    stream.push(makeEntry(1000, "info", "app", "Started"));
    stream.push(makeEntry(2000, "warn", "git", "Uncommitted changes"));

    render(
      <ActivityPanel open={true} onOpenChange={() => {}} stream={stream} />,
    );
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Uncommitted changes")).toBeInTheDocument();
  });

  it("renders scope for each entry", () => {
    const stream = createActivityLogStream();
    stream.push(makeEntry(1000, "info", "agent", "Running"));

    render(
      <ActivityPanel open={true} onOpenChange={() => {}} stream={stream} />,
    );
    expect(screen.getByText("agent")).toBeInTheDocument();
  });

  it("renders level badges", () => {
    const stream = createActivityLogStream();
    stream.push(makeEntry(1000, "error", "app", "Crashed"));

    render(
      <ActivityPanel open={true} onOpenChange={() => {}} stream={stream} />,
    );
    const badges = screen.getAllByText("error");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by level", () => {
    const stream = createActivityLogStream();
    stream.push(makeEntry(1000, "info", "app", "Info msg"));
    stream.push(makeEntry(2000, "error", "app", "Error msg"));

    render(
      <ActivityPanel open={true} onOpenChange={() => {}} stream={stream} />,
    );

    expect(screen.getByText("Info msg")).toBeInTheDocument();
    expect(screen.getByText("Error msg")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("activity-filter-level-error"));

    expect(screen.queryByText("Info msg")).toBeNull();
    expect(screen.getByText("Error msg")).toBeInTheDocument();
  });

  it("filters by scope", () => {
    const stream = createActivityLogStream();
    stream.push(makeEntry(1000, "info", "agent", "agent msg"));
    stream.push(makeEntry(2000, "info", "git", "git msg"));

    render(
      <ActivityPanel open={true} onOpenChange={() => {}} stream={stream} />,
    );

    const scopeInput = screen.getByTestId("activity-filter-scope");
    fireEvent.change(scopeInput, { target: { value: "git" } });

    expect(screen.queryByText("agent msg")).toBeNull();
    expect(screen.getByText("git msg")).toBeInTheDocument();
  });

  it("close button invokes onOpenChange(false)", () => {
    const stream = createActivityLogStream();
    const onOpenChange = vi.fn();
    render(
      <ActivityPanel open={true} onOpenChange={onOpenChange} stream={stream} />,
    );
    fireEvent.click(screen.getByTestId("activity-close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("backdrop click closes the drawer", () => {
    const stream = createActivityLogStream();
    const onOpenChange = vi.fn();
    render(
      <ActivityPanel open={true} onOpenChange={onOpenChange} stream={stream} />,
    );
    fireEvent.click(screen.getByTestId("activity-backdrop"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Escape closes the drawer", () => {
    const stream = createActivityLogStream();
    const onOpenChange = vi.fn();
    render(
      <ActivityPanel open={true} onOpenChange={onOpenChange} stream={stream} />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clear button empties entries", () => {
    const stream = createActivityLogStream();
    stream.push(makeEntry(1000, "info", "app", "hello"));

    render(
      <ActivityPanel open={true} onOpenChange={() => {}} stream={stream} />,
    );
    expect(screen.getByText("hello")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("activity-clear"));
    expect(screen.queryByText("hello")).toBeNull();
    expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
  });

  it("auto-scrolls to bottom when new entries arrive", async () => {
    const stream = createActivityLogStream();
    for (let i = 0; i < 50; i++) {
      stream.push(makeEntry(i * 1000, "info", "app", `entry-${i}`));
    }

    render(
      <ActivityPanel open={true} onOpenChange={() => {}} stream={stream} />,
    );

    const scrollContainer = screen.getByTestId("activity-scroll-container");

    await waitFor(() => {
      expect(
        scrollContainer.scrollTop + scrollContainer.clientHeight,
      ).toBeGreaterThanOrEqual(scrollContainer.scrollHeight - 40);
    });
  });
});
