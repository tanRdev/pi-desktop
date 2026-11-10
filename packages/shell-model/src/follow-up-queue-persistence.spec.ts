import { describe, expect, it } from "vitest";
import {
  sanitizeFollowUpQueue,
  sanitizeFollowUpQueues,
} from "./follow-up-queue-persistence";

describe("sanitizeFollowUpQueues", () => {
  it("keeps well-formed queues and items", () => {
    const queues = sanitizeFollowUpQueues({
      "thread-1": {
        paused: true,
        items: [
          {
            id: "a",
            text: "hello",
            status: "queued",
            createdAt: 1,
            updatedAt: 2,
            attempts: 0,
            lastError: null,
            images: [{ type: "image", mimeType: "image/png", data: "AA==" }],
          },
        ],
      },
    });

    expect(queues["thread-1"]).toEqual({
      threadId: "thread-1",
      paused: true,
      items: [
        {
          id: "a",
          threadId: "thread-1",
          text: "hello",
          status: "queued",
          createdAt: 1,
          updatedAt: 2,
          attempts: 0,
          lastError: null,
          images: [{ type: "image", mimeType: "image/png", data: "AA==" }],
        },
      ],
    });
  });

  it("rehydrates a persisted sending item as failed so it is never silently resent", () => {
    const queues = sanitizeFollowUpQueues({
      "thread-1": {
        items: [
          {
            id: "a",
            text: "in flight",
            status: "sending",
            createdAt: 1,
            updatedAt: 2,
            attempts: 1,
            lastError: null,
            images: [],
          },
        ],
      },
    });

    expect(queues["thread-1"]?.items[0]).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: "Delivery was interrupted before it completed",
    });
  });

  it("drops malformed items and images with unsupported MIME types", () => {
    const queue = sanitizeFollowUpQueue(
      {
        items: [
          { id: "ok", text: "fine", status: "sent", images: [] },
          { text: "missing id", status: "queued", images: [] },
          { id: "bad-status", text: "x", status: "lost", images: [] },
          { id: "empty", text: "  ", status: "queued", images: [] },
          {
            id: "img",
            text: "pic",
            status: "queued",
            images: [
              { type: "image", mimeType: "image/bmp", data: "AA==" },
              { type: "image", mimeType: "image/webp", data: "BB==" },
              { type: "file", mimeType: "image/png", data: "CC==" },
            ],
          },
        ],
      },
      "thread-9",
    );

    expect(queue?.items.map((item) => item.id)).toEqual(["ok", "img"]);
    expect(queue?.items[1]?.images).toEqual([
      { type: "image", mimeType: "image/webp", data: "BB==" },
    ]);
  });

  it("returns an empty record for non-object input", () => {
    expect(sanitizeFollowUpQueues(null)).toEqual({});
    expect(sanitizeFollowUpQueues("nope")).toEqual({});
    expect(sanitizeFollowUpQueues([1, 2])).toEqual({});
  });
});
