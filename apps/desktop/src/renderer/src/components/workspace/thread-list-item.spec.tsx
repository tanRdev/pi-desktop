// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThread } from "../../../../test/factories";
import { renderWithProviders } from "../../../../test/render-helpers";
import { ThreadListItem } from "./thread-list-item";

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

describe("ThreadListItem", () => {
  it("renders the thread title", () => {
    const thread = createThread({ title: "Plan the migration" });
    renderWithProviders(
      <ThreadListItem thread={thread} isActive={false} onClick={() => {}} />,
    );
    expect(screen.getByText("Plan the migration")).toBeInTheDocument();
  });

  it("falls back to default title when thread title is empty", () => {
    const thread = createThread({ title: "" });
    renderWithProviders(
      <ThreadListItem thread={thread} isActive={false} onClick={() => {}} />,
    );
    expect(screen.getByText("Pi")).toBeInTheDocument();
  });

  it("invokes onClick when the row is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <ThreadListItem
        thread={createThread()}
        isActive={false}
        onClick={onClick}
      />,
    );
    await user.click(screen.getByTestId("thread-list-item"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks the title with current-thread-title test id when active", () => {
    renderWithProviders(
      <ThreadListItem
        thread={createThread({ title: "Active" })}
        isActive={true}
        onClick={() => {}}
      />,
    );
    expect(screen.getByTestId("current-thread-title")).toHaveTextContent(
      "Active",
    );
  });

  it("does not render a close button when onClose is omitted", () => {
    renderWithProviders(
      <ThreadListItem
        thread={createThread()}
        isActive={false}
        onClick={() => {}}
      />,
    );
    expect(screen.queryByTestId("thread-close-button")).toBeNull();
  });

  it("calls onClose and stops click propagation when close is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ThreadListItem
        thread={createThread()}
        isActive={false}
        onClick={onClick}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByTestId("thread-close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("invokes onClose when Enter is pressed on the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ThreadListItem
        thread={createThread()}
        isActive={false}
        onClick={() => {}}
        onClose={onClose}
      />,
    );
    const closeBtn = screen.getByTestId("thread-close-button");
    closeBtn.focus();
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalled();
  });
});
