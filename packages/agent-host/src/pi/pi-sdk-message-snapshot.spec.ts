import { describe, expect, it } from "vitest";

import { toSnapshotMessages } from "./pi-sdk-message-snapshot.js";

describe("toSnapshotMessages", () => {
  it("maps assistant, toolResult, and custom messages into snapshot messages", () => {
    expect(
      toSnapshotMessages([
        {
          role: "assistant",
          timestamp: 1,
          content: [{ type: "text", text: "hello" }],
        },
        {
          role: "toolResult",
          timestamp: 2,
          content: "done",
        },
        {
          role: "custom",
          customType: "notice",
          timestamp: 3,
          content: [{ type: "text", text: "system note" }],
        },
      ]),
    ).toEqual([
      {
        id: "assistant-1",
        role: "assistant",
        text: "hello",
        status: "complete",
        timestamp: 1,
      },
      {
        id: "tool-2",
        role: "tool",
        text: "done",
        status: "complete",
        timestamp: 2,
      },
      {
        id: "custom-notice-3",
        role: "system",
        text: "system note",
        status: "complete",
        timestamp: 3,
      },
    ]);
  });

  it("drops hidden custom messages and invalid or unknown messages", () => {
    expect(
      toSnapshotMessages([
        {
          role: "custom",
          customType: "hidden",
          timestamp: 1,
          display: false,
          content: [{ type: "text", text: "ignore me" }],
        },
        {
          role: "branchSummary",
          timestamp: 2,
          content: [{ type: "text", text: "ignore me too" }],
        },
        null,
      ]),
    ).toEqual([]);
  });

  it("joins only text fragments from array content", () => {
    expect(
      toSnapshotMessages([
        {
          role: "assistant",
          timestamp: 10,
          content: [
            { type: "text", text: "alpha" },
            { type: "image" },
            { type: "text", text: "beta" },
          ],
        },
      ]),
    ).toEqual([
      {
        id: "assistant-10",
        role: "assistant",
        text: "alphabeta",
        status: "complete",
        timestamp: 10,
      },
    ]);
  });
});
