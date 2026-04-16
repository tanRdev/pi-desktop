import type { FileWindow, ThreadSnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadTabs } from "./thread-tabs";

function createFileTabs(): FileWindow[] {
  return [
    {
      id: "file-1",
      kind: "file",
      title: "alpha.ts",
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      zIndex: 1,
      isFocused: true,
      state: "normal",
      filePath: "/tmp/alpha.ts",
      isDirty: true,
      isReadOnly: false,
    },
  ];
}

function createThreads(): ThreadSnapshot[] {
  return [
    {
      id: "thread-1",
      title: "Alpha",
      lastActivityAt: 1,
      runtime: {
        status: "ready",
        lastError: null,
      },
    },
    {
      id: "thread-2",
      title: "Beta",
      lastActivityAt: 2,
      runtime: {
        status: "streaming",
        lastError: null,
      },
    },
    {
      id: "thread-3",
      title: "Gamma",
      lastActivityAt: 3,
      runtime: {
        status: "ready",
        lastError: null,
      },
    },
  ];
}

afterEach(() => {
  cleanup();
});

describe("ThreadTabs", () => {
  it("renders threads and forwards select, close, and create actions", async () => {
    const user = userEvent.setup();
    const onSelectThread = vi.fn();
    const onCloseThread = vi.fn();
    const onCreateThread = vi.fn(async () => undefined);

    render(
      <ThreadTabs
        threads={createThreads()}
        activeThreadId="thread-1"
        onSelectThread={onSelectThread}
        onCloseThread={onCloseThread}
        onCreateThread={onCreateThread}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Beta" }));
    await user.click(screen.getByRole("button", { name: "Close Alpha" }));
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(onSelectThread).toHaveBeenCalledWith("thread-2");
    expect(onCloseThread).toHaveBeenCalledWith("thread-1");
    expect(onCreateThread).toHaveBeenCalledTimes(1);
  });

  it("keeps create action visible when no threads remain", () => {
    render(
      <ThreadTabs
        threads={[]}
        activeThreadId={null}
        onSelectThread={vi.fn()}
        onCloseThread={vi.fn()}
        onCreateThread={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Create thread" }),
    ).toBeInTheDocument();
  });

  it("uses workspace row styling instead of mono uppercase tab labels", () => {
    render(
      <ThreadTabs
        threads={createThreads()}
        activeThreadId="thread-1"
        onSelectThread={vi.fn()}
        onCloseThread={vi.fn()}
        onCreateThread={vi.fn()}
      />,
    );

    const activeTab = screen.getByRole("button", { name: "Alpha" });
    const activeLabel = screen.getByText("Alpha");
    const activeTabContainer = activeTab.parentElement;

    expect(activeTabContainer).toHaveClass("border-b");
    expect(activeTab).not.toHaveClass("font-mono");
    expect(activeLabel).not.toHaveClass("uppercase");
    expect(activeLabel).not.toHaveClass("tracking-widest");
  });

  it("renders file tabs inside the same primary strip", async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();
    const onCloseFile = vi.fn();

    render(
      <ThreadTabs
        threads={createThreads()}
        fileTabs={createFileTabs()}
        activeThreadId="thread-1"
        activeFileId="file-1"
        onSelectThread={vi.fn()}
        onCloseThread={vi.fn()}
        onCreateThread={vi.fn()}
        onSelectFile={onSelectFile}
        onCloseFile={onCloseFile}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("alpha.ts *")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "alpha.ts" }));
    await user.click(screen.getByRole("button", { name: "Close alpha.ts" }));

    expect(onSelectFile).toHaveBeenCalledWith("file-1");
    expect(onCloseFile).toHaveBeenCalledWith("file-1");
  });

  it("highlights active thread tab with accent border", () => {
    render(
      <ThreadTabs
        threads={createThreads()}
        activeThreadId="thread-2"
        onSelectThread={vi.fn()}
        onCloseThread={vi.fn()}
        onCreateThread={vi.fn()}
      />,
    );

    const activeButton = screen.getByRole("button", { name: "Beta" });
    const activeContainer = activeButton.parentElement;
    expect(activeContainer).toHaveClass("border-white/20");

    const inactiveButton = screen.getByRole("button", { name: "Alpha" });
    const inactiveContainer = inactiveButton.parentElement;
    expect(inactiveContainer).toHaveClass("border-transparent");
  });

  it("highlights active file tab with accent border", () => {
    render(
      <ThreadTabs
        threads={createThreads()}
        fileTabs={createFileTabs()}
        activeThreadId="thread-1"
        activeFileId="file-1"
        onSelectThread={vi.fn()}
        onCloseThread={vi.fn()}
        onCreateThread={vi.fn()}
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
      />,
    );

    const fileButton = screen.getByRole("button", { name: "alpha.ts" });
    const fileContainer = fileButton.parentElement;
    expect(fileContainer).toHaveClass("border-white/20");
  });

  it("shows streaming indicator for streaming threads", () => {
    render(
      <ThreadTabs
        threads={createThreads()}
        activeThreadId="thread-1"
        onSelectThread={vi.fn()}
        onCloseThread={vi.fn()}
        onCreateThread={vi.fn()}
      />,
    );

    // Beta (thread-2) has runtime.status === "streaming"
    const betaButton = screen.getByRole("button", { name: "Beta" });
    const streamingDot = betaButton.querySelector(".animate-pulse");
    expect(streamingDot).toBeInTheDocument();

    // Alpha (thread-1) is ready — no pulse
    const alphaButton = screen.getByRole("button", { name: "Alpha" });
    const noPulse = alphaButton.querySelector(".animate-pulse");
    expect(noPulse).not.toBeInTheDocument();
  });

  it("still shows close button for last remaining thread", () => {
    const singleThread: ThreadSnapshot[] = [
      {
        id: "thread-1",
        title: "Only",
        lastActivityAt: 1,
        runtime: { status: "ready", lastError: null },
      },
    ];

    render(
      <ThreadTabs
        threads={singleThread}
        activeThreadId="thread-1"
        onSelectThread={vi.fn()}
        onCloseThread={vi.fn()}
        onCreateThread={vi.fn()}
      />,
    );

    // The component does not hide the close button for a single thread
    expect(
      screen.getByRole("button", { name: "Close Only" }),
    ).toBeInTheDocument();
  });

  it("handles missing optional file tab callbacks gracefully", async () => {
    const user = userEvent.setup();

    // Render with fileTabs but WITHOUT onSelectFile/onCloseFile
    render(
      <ThreadTabs
        threads={createThreads()}
        fileTabs={createFileTabs()}
        activeThreadId="thread-1"
        activeFileId="file-1"
        onSelectThread={vi.fn()}
        onCloseThread={vi.fn()}
        onCreateThread={vi.fn()}
      />,
    );

    // Should render without crashing
    expect(screen.getByText("alpha.ts *")).toBeInTheDocument();

    // Clicking should not throw (optional chaining in component)
    await user.click(screen.getByRole("button", { name: "alpha.ts" }));
    await user.click(screen.getByRole("button", { name: "Close alpha.ts" }));
  });
});
