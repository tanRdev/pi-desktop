import type { PromptImageAttachment } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import {
  createEmptyFollowUpQueue,
  editFollowUpItem,
  enqueueFollowUpItem,
  markFollowUpFailed,
  markFollowUpSending,
  markFollowUpSent,
  moveFollowUpItem,
  removeFollowUpItem,
  retryFollowUpItem,
  selectNextDispatchableItem,
  setFollowUpQueuePaused,
} from "./follow-up-queue";

const IMAGE: PromptImageAttachment = {
  type: "image",
  mimeType: "image/png",
  data: "aGVsbG8=",
};

function queueWith(texts: string[]) {
  let queue = createEmptyFollowUpQueue("thread-1");
  texts.forEach((text, index) => {
    queue = enqueueFollowUpItem(queue, {
      id: `item-${index + 1}`,
      text,
      now: 100 + index,
    });
  });
  return queue;
}

describe("follow-up queue operations", () => {
  it("enqueues trimmed items in order with queued status", () => {
    const queue = queueWith(["  first  ", "second"]);
    expect(queue.items.map((item) => item.text)).toEqual(["first", "second"]);
    expect(queue.items.map((item) => item.status)).toEqual([
      "queued",
      "queued",
    ]);
    expect(queue.items[0]).toMatchObject({
      threadId: "thread-1",
      attempts: 0,
      lastError: null,
      images: [],
    });
  });

  it("ignores empty enqueue text", () => {
    const queue = createEmptyFollowUpQueue("thread-1");
    expect(enqueueFollowUpItem(queue, { id: "x", text: "  ", now: 1 })).toBe(
      queue,
    );
  });

  it("carries typed image attachments on the item", () => {
    const queue = enqueueFollowUpItem(createEmptyFollowUpQueue("t"), {
      id: "i1",
      text: "look",
      images: [IMAGE],
      now: 5,
    });
    expect(queue.items[0]?.images).toEqual([IMAGE]);
  });

  it("edits queued and failed items but not sending or sent items", () => {
    let queue = queueWith(["one", "two", "three"]);
    queue = editFollowUpItem(queue, "item-1", { text: "one edited", now: 200 });
    expect(queue.items[0]?.text).toBe("one edited");

    queue = markFollowUpSending(queue, "item-1", 201);
    expect(editFollowUpItem(queue, "item-1", { text: "nope", now: 202 })).toBe(
      queue,
    );

    queue = markFollowUpSent(queue, "item-1", 203);
    expect(editFollowUpItem(queue, "item-1", { text: "nope", now: 204 })).toBe(
      queue,
    );

    queue = markFollowUpSending(queue, "item-2", 205);
    queue = markFollowUpFailed(queue, "item-2", "boom", 206);
    const edited = editFollowUpItem(queue, "item-2", {
      text: "two edited",
      now: 207,
    });
    expect(edited.items[1]).toMatchObject({
      text: "two edited",
      status: "failed",
    });
  });

  it("rejects edits that empty the text", () => {
    const queue = queueWith(["one"]);
    expect(editFollowUpItem(queue, "item-1", { text: " ", now: 1 })).toBe(
      queue,
    );
  });

  it("deletes items except while sending", () => {
    let queue = queueWith(["one", "two"]);
    queue = markFollowUpSending(queue, "item-1", 10);
    expect(removeFollowUpItem(queue, "item-1")).toBe(queue);
    expect(
      removeFollowUpItem(queue, "item-2").items.map((item) => item.id),
    ).toEqual(["item-1"]);
  });

  it("reorders items within bounds and never swaps a sending item", () => {
    let queue = queueWith(["one", "two", "three"]);
    queue = moveFollowUpItem(queue, "item-2", -1);
    expect(queue.items.map((item) => item.text)).toEqual([
      "two",
      "one",
      "three",
    ]);
    expect(moveFollowUpItem(queue, "item-2", -1)).toBe(queue);

    queue = markFollowUpSending(queue, "item-2", 10);
    expect(moveFollowUpItem(queue, "item-1", -1)).toBe(queue);
    expect(moveFollowUpItem(queue, "item-2", 1)).toBe(queue);
  });

  it("pauses and resumes the queue", () => {
    const queue = queueWith(["one"]);
    const paused = setFollowUpQueuePaused(queue, true);
    expect(paused.paused).toBe(true);
    expect(setFollowUpQueuePaused(paused, true)).toBe(paused);
    expect(setFollowUpQueuePaused(paused, false).paused).toBe(false);
  });

  it("selects only a queued head, skipping sent items", () => {
    let queue = queueWith(["one", "two"]);
    expect(selectNextDispatchableItem(queue)?.id).toBe("item-1");

    queue = markFollowUpSending(queue, "item-1", 10);
    expect(selectNextDispatchableItem(queue)).toBeNull();

    queue = markFollowUpSent(queue, "item-1", 11);
    expect(selectNextDispatchableItem(queue)?.id).toBe("item-2");
  });

  it("blocks dispatch when paused or when the head failed", () => {
    let queue = queueWith(["one", "two"]);
    expect(
      selectNextDispatchableItem(setFollowUpQueuePaused(queue, true)),
    ).toBeNull();

    queue = markFollowUpSending(queue, "item-1", 10);
    queue = markFollowUpFailed(queue, "item-1", "boom", 11);
    expect(selectNextDispatchableItem(queue)).toBeNull();
  });

  it("marks sending with an incremented attempt count and sent as terminal", () => {
    let queue = queueWith(["one"]);
    queue = markFollowUpSending(queue, "item-1", 10);
    expect(queue.items[0]).toMatchObject({ status: "sending", attempts: 1 });
    // A sending item cannot be marked sending again (exactly-once guard).
    expect(markFollowUpSending(queue, "item-1", 11)).toBe(queue);
    queue = markFollowUpSent(queue, "item-1", 12);
    expect(queue.items[0]).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("failure preserves the item text and images at the head", () => {
    let queue = enqueueFollowUpItem(createEmptyFollowUpQueue("thread-1"), {
      id: "item-1",
      text: "look at this",
      images: [IMAGE],
      now: 1,
    });
    queue = markFollowUpSending(queue, "item-1", 2);
    queue = markFollowUpFailed(queue, "item-1", "runtime offline", 3);
    expect(queue.items[0]).toMatchObject({
      status: "failed",
      text: "look at this",
      images: [IMAGE],
      lastError: "runtime offline",
    });
  });

  it("retry requeues only failed items and clears the error", () => {
    let queue = queueWith(["one"]);
    expect(retryFollowUpItem(queue, "item-1", 5)).toBe(queue);
    queue = markFollowUpSending(queue, "item-1", 6);
    queue = markFollowUpFailed(queue, "item-1", "boom", 7);
    queue = retryFollowUpItem(queue, "item-1", 8);
    expect(queue.items[0]).toMatchObject({ status: "queued", lastError: null });
    expect(selectNextDispatchableItem(queue)?.id).toBe("item-1");
  });
});
