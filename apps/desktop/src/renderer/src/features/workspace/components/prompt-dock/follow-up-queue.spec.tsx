// @vitest-environment jsdom
import type { FollowUpItem, FollowUpQueueState } from "@pi-desktop/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowUpQueue } from "./follow-up-queue";

function createItem(overrides: Partial<FollowUpItem> = {}): FollowUpItem {
  return {
    id: "item-1",
    threadId: "thread-1",
    text: "follow up text",
    images: [],
    status: "queued",
    createdAt: 1,
    updatedAt: 1,
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

function createQueue(items: FollowUpItem[]): FollowUpQueueState {
  return { threadId: "thread-1", paused: false, items };
}

function renderQueue(
  queue: FollowUpQueueState | undefined,
  overrides: Partial<Parameters<typeof FollowUpQueue>[0]> = {},
) {
  const props = {
    queue,
    supportsSteer: false,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onTogglePaused: vi.fn(),
    onRetry: vi.fn(),
    onSteerItem: vi.fn(),
    ...overrides,
  };
  render(<FollowUpQueue {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
});

describe("FollowUpQueue", () => {
  it("renders nothing when the queue is empty or missing", () => {
    const { container } = render(
      <FollowUpQueue
        queue={undefined}
        supportsSteer={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onTogglePaused={vi.fn()}
        onRetry={vi.fn()}
        onSteerItem={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("follow-up-queue")).toBeNull();
  });

  it("shows each item with its explicit delivery status and image count", () => {
    renderQueue(
      createQueue([
        createItem({ id: "a", text: "first", status: "queued" }),
        createItem({
          id: "b",
          text: "second",
          status: "failed",
          lastError: "runtime offline",
          images: [{ type: "image", mimeType: "image/png", data: "AA==" }],
        }),
        createItem({ id: "c", text: "third", status: "sent" }),
      ]),
    );

    const items = screen.getAllByTestId("follow-up-item");
    expect(items).toHaveLength(3);
    expect(items[0]?.dataset.status).toBe("queued");
    expect(items[1]?.dataset.status).toBe("failed");
    expect(items[1]?.textContent).toContain("runtime offline");
    expect(items[1]?.textContent).toContain("1 image");
    expect(items[2]?.dataset.status).toBe("sent");
  });

  it("fires edit, delete, reorder, and retry operations", () => {
    const props = renderQueue(
      createQueue([
        createItem({ id: "a", text: "first" }),
        createItem({
          id: "b",
          text: "second",
          status: "failed",
          lastError: "boom",
        }),
      ]),
    );

    const first = screen.getAllByTestId("follow-up-item")[0] as HTMLElement;
    const second = screen.getAllByTestId("follow-up-item")[1] as HTMLElement;

    fireEvent.click(within(second).getByTestId("follow-up-move-up"));
    expect(props.onMove).toHaveBeenCalledWith("b", -1);

    fireEvent.click(within(second).getByTestId("follow-up-retry"));
    expect(props.onRetry).toHaveBeenCalledWith("b");

    fireEvent.click(within(first).getByTestId("follow-up-edit"));
    const input = within(first).getByTestId(
      "follow-up-edit-input",
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "first edited" } });
    fireEvent.click(within(first).getByTestId("follow-up-edit-save"));
    expect(props.onEdit).toHaveBeenCalledWith("a", "first edited");

    fireEvent.click(within(first).getByTestId("follow-up-delete"));
    expect(props.onDelete).toHaveBeenCalledWith("a");
  });

  it("toggles pause and labels the paused state", () => {
    const props = renderQueue(createQueue([createItem()]));
    fireEvent.click(screen.getByTestId("follow-up-pause-toggle"));
    expect(props.onTogglePaused).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("follow-up-pause-toggle").textContent).toBe(
      "Pause",
    );
  });

  it("shows steer only when supported and never for a sending item", () => {
    renderQueue(
      createQueue([
        createItem({ id: "a", text: "queued one" }),
        createItem({ id: "b", text: "sending one", status: "sending" }),
      ]),
      { supportsSteer: true },
    );

    const items = screen.getAllByTestId("follow-up-item");
    expect(
      within(items[0] as HTMLElement).queryByTestId("follow-up-steer"),
    ).not.toBeNull();
    expect(
      within(items[1] as HTMLElement).queryByTestId("follow-up-steer"),
    ).toBeNull();
    expect(
      (
        within(items[1] as HTMLElement).getByTestId(
          "follow-up-delete",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
