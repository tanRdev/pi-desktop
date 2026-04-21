// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContextWindow } from "@/features/workspace/workspace-pane-state";
import { TitleBar } from "./title-bar";

const makeFileWindow = (
  overrides: Partial<ContextWindow> & { id?: string; filePath?: string } = {},
): ContextWindow =>
  ({
    id: overrides.id ?? "file-1",
    kind: "file",
    title: "App.tsx",
    filePath: overrides.filePath ?? "/src/App.tsx",
    isDirty: false,
    isFocused: false,
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    zIndex: 1,
    ...overrides,
  }) as ContextWindow;

afterEach(() => {
  cleanup();
});

describe("TitleBar", () => {
  it("renders with correct traffic-light spacing on macOS", () => {
    const { container } = render(
      <TitleBar
        platform="darwin"
        hasActiveThread
        hasChangesToCommit
        onAgentGitAction={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toHaveStyle({ paddingLeft: "16px" });
    expect(
      screen.getByRole("button", { name: /Commit & Push/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "More git actions" }),
    ).toBeVisible();
  });

  it("invokes onAgentGitAction when clicking Commit & Push with changes", async () => {
    const user = userEvent.setup();
    const onAgentGitAction = vi.fn();

    render(
      <TitleBar
        platform="darwin"
        hasActiveThread
        hasChangesToCommit
        onAgentGitAction={onAgentGitAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Commit & Push/i }));
    expect(onAgentGitAction).toHaveBeenCalledTimes(1);
    expect(onAgentGitAction).toHaveBeenCalledWith(
      expect.stringContaining("push to origin"),
    );
  });

  it("disables the commit button when there are no changes", () => {
    render(
      <TitleBar
        platform="darwin"
        hasActiveThread
        hasChangesToCommit={false}
        onAgentGitAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Commit & Push/i }),
    ).toBeDisabled();
  });

  it("disables all git buttons when there is no active thread", () => {
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

  it("renders chat and file tabs when context windows are provided", () => {
    const onSelectContextSurface = vi.fn();
    render(
      <TitleBar
        platform="darwin"
        activeThreadId="thread-1"
        activeThreadTitle="My Chat"
        contextWindows={[makeFileWindow()]}
        selectedContextSurface="file-1"
        onSelectContextSurface={onSelectContextSurface}
      />,
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("My Chat")).toBeInTheDocument();
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
  });

  it("calls onSelectContextSurface with null when chat tab is clicked", async () => {
    const user = userEvent.setup();
    const onSelectContextSurface = vi.fn();

    render(
      <TitleBar
        platform="darwin"
        activeThreadId="thread-1"
        activeThreadTitle="Chat"
        contextWindows={[makeFileWindow()]}
        selectedContextSurface="file-1"
        onSelectContextSurface={onSelectContextSurface}
      />,
    );

    await user.click(screen.getByText("Chat"));
    expect(onSelectContextSurface).toHaveBeenCalledWith(null);
  });

  it("calls onSelectContextSurface with window id when file tab is clicked", async () => {
    const user = userEvent.setup();
    const onSelectContextSurface = vi.fn();

    render(
      <TitleBar
        platform="darwin"
        activeThreadId="thread-1"
        activeThreadTitle="Chat"
        contextWindows={[makeFileWindow()]}
        selectedContextSurface={null}
        onSelectContextSurface={onSelectContextSurface}
      />,
    );

    await user.click(screen.getByText("App.tsx"));
    expect(onSelectContextSurface).toHaveBeenCalledWith("file-1");
  });
});
