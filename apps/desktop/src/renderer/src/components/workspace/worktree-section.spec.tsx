import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThread, createWorktree } from "../../../../test/factories";
import { renderWithProviders } from "../../../../test/render-helpers";
import { WorktreeSection } from "./worktree-section";

// phosphor icons render real svgs; no mocking needed, but keep test fast
// by stubbing icon library used by thread-list-item child.
vi.mock("@/components/ui/icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Stub = (props: Record<string, unknown>) =>
    React.createElement("span", props);
  return {
    ChatText: Stub,
    X: Stub,
    ICON_SIZE_XS: "size-3",
  };
});

afterEach(() => {
  cleanup();
});

describe("WorktreeSection", () => {
  it("renders worktree label and its threads", () => {
    const worktree = createWorktree({
      label: "feature/login",
      threads: [
        createThread({ id: "t1", title: "Design auth" }),
        createThread({ id: "t2", title: "Wire up API" }),
      ],
    });
    renderWithProviders(
      <WorktreeSection
        worktree={worktree}
        activeThreadId={null}
        isExpanded={true}
        onToggleExpand={() => {}}
        onSelectThread={() => {}}
        onCreateThread={() => {}}
      />,
    );
    expect(screen.getByText("feature/login")).toBeInTheDocument();
    expect(screen.getByText("Design auth")).toBeInTheDocument();
    expect(screen.getByText("Wire up API")).toBeInTheDocument();
  });

  it("invokes onToggleExpand when the header is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderWithProviders(
      <WorktreeSection
        worktree={createWorktree({ label: "main" })}
        activeThreadId={null}
        isExpanded={false}
        onToggleExpand={onToggle}
        onSelectThread={() => {}}
        onCreateThread={() => {}}
      />,
    );
    await user.click(screen.getByText("main"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectThread with the thread id when a thread is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const worktree = createWorktree({
      threads: [createThread({ id: "target", title: "Pick me" })],
    });
    renderWithProviders(
      <WorktreeSection
        worktree={worktree}
        activeThreadId={null}
        isExpanded={true}
        onToggleExpand={() => {}}
        onSelectThread={onSelect}
        onCreateThread={() => {}}
      />,
    );
    await user.click(screen.getByText("Pick me"));
    expect(onSelect).toHaveBeenCalledWith("target");
  });

  it("calls onCreateThread when the new-chat button is clicked", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    renderWithProviders(
      <WorktreeSection
        worktree={createWorktree()}
        activeThreadId={null}
        isExpanded={true}
        onToggleExpand={() => {}}
        onSelectThread={() => {}}
        onCreateThread={onCreate}
      />,
    );
    await user.click(screen.getByTestId("create-thread-button"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("shows creating state while onCreateThread is in flight", async () => {
    const user = userEvent.setup();
    let resolve: () => void = () => {};
    const inFlight = new Promise<void>((res) => {
      resolve = res;
    });
    const onCreate = vi.fn(() => inFlight);
    renderWithProviders(
      <WorktreeSection
        worktree={createWorktree()}
        activeThreadId={null}
        isExpanded={true}
        onToggleExpand={() => {}}
        onSelectThread={() => {}}
        onCreateThread={onCreate}
      />,
    );
    await user.click(screen.getByTestId("create-thread-button"));
    expect(screen.getByText("Creating…")).toBeInTheDocument();
    resolve();
    await inFlight;
  });

  it("forwards onCloseThread to thread items when provided", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const worktree = createWorktree({
      threads: [createThread({ id: "closable", title: "Close me" })],
    });
    renderWithProviders(
      <WorktreeSection
        worktree={worktree}
        activeThreadId={null}
        isExpanded={true}
        onToggleExpand={() => {}}
        onSelectThread={() => {}}
        onCreateThread={() => {}}
        onCloseThread={onClose}
      />,
    );
    await user.click(screen.getByTestId("thread-close-button"));
    expect(onClose).toHaveBeenCalledWith("closable");
  });

  it("omits close buttons when onCloseThread is not provided", () => {
    const worktree = createWorktree({
      threads: [createThread({ id: "t1", title: "Solo" })],
    });
    renderWithProviders(
      <WorktreeSection
        worktree={worktree}
        activeThreadId={null}
        isExpanded={true}
        onToggleExpand={() => {}}
        onSelectThread={() => {}}
        onCreateThread={() => {}}
      />,
    );
    expect(screen.queryByTestId("thread-close-button")).toBeNull();
  });
});
