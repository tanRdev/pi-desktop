import type { ThreadSnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadTabs } from "./thread-tabs";

function createThreads(): ThreadSnapshot[] {
  return [
    {
      id: "thread-1",
      title: "Alpha",
      isArchived: false,
      lastActivityAt: 1,
      runtime: {
        status: "ready",
        lastError: null,
      },
    },
    {
      id: "thread-2",
      title: "Beta",
      isArchived: false,
      lastActivityAt: 2,
      runtime: {
        status: "streaming",
        lastError: null,
      },
    },
    {
      id: "thread-3",
      title: "Gamma",
      isArchived: true,
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
  it("renders open threads and forwards select, close, and create actions", async () => {
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
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Beta" }));
    await user.click(screen.getByRole("button", { name: "Close Alpha" }));
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(onSelectThread).toHaveBeenCalledWith("thread-2");
    expect(onCloseThread).toHaveBeenCalledWith("thread-1");
    expect(onCreateThread).toHaveBeenCalledTimes(1);
  });

  it("keeps create action visible when no open threads remain", () => {
    render(
      <ThreadTabs
        threads={[
          {
            id: "thread-archived",
            title: "Archived",
            isArchived: true,
            lastActivityAt: 1,
            runtime: {
              status: "ready",
              lastError: null,
            },
          },
        ]}
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
});
