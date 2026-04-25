import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import { buildChatTurns } from "./chat-thread-turns";

function createMessage(
  overrides: Partial<AgentMessageSnapshot>,
): AgentMessageSnapshot {
  return {
    id: "message-1",
    role: "assistant",
    text: "hello",
    status: "complete",
    timestamp: 1,
    ...overrides,
  };
}

describe("buildChatTurns", () => {
  it("groups pre-user assistant output and tracks last assistant completion per turn", () => {
    const turns = buildChatTurns([
      createMessage({
        id: "assistant-prelude",
        role: "assistant",
        text: "Prelude",
        timestamp: 10,
      }),
      createMessage({
        id: "user-1",
        role: "user",
        text: "First question",
        timestamp: 20,
      }),
      createMessage({
        id: "tool-1",
        role: "tool",
        text: "Running tool",
        status: "streaming",
        timestamp: 25,
      }),
      createMessage({
        id: "assistant-1",
        role: "assistant",
        text: "First answer",
        timestamp: 30,
      }),
      createMessage({
        id: "user-2",
        role: "user",
        text: "Second question",
        timestamp: 40,
      }),
    ]);

    expect(turns).toEqual([
      {
        id: "pre-turn-assistant-prelude",
        userMessage: null,
        messages: [
          createMessage({
            id: "assistant-prelude",
            role: "assistant",
            text: "Prelude",
            timestamp: 10,
          }),
        ],
        lastAssistantTimestamp: 10,
        isStreaming: false,
      },
      {
        id: "user-1",
        userMessage: createMessage({
          id: "user-1",
          role: "user",
          text: "First question",
          timestamp: 20,
        }),
        messages: [
          createMessage({
            id: "tool-1",
            role: "tool",
            text: "Running tool",
            status: "streaming",
            timestamp: 25,
          }),
          createMessage({
            id: "assistant-1",
            role: "assistant",
            text: "First answer",
            timestamp: 30,
          }),
        ],
        lastAssistantTimestamp: 30,
        isStreaming: true,
      },
      {
        id: "user-2",
        userMessage: createMessage({
          id: "user-2",
          role: "user",
          text: "Second question",
          timestamp: 40,
        }),
        messages: [],
        lastAssistantTimestamp: null,
        isStreaming: false,
      },
    ]);
  });
});
