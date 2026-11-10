import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import { buildChatTurns, createChatTurnsBuilder } from "./chat-thread-turns";

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

  it("preserves unchanged turn identities across streaming updates", () => {
    const builder = createChatTurnsBuilder();
    const completed = createMessage({
      id: "user-1",
      role: "user",
      text: "First question",
      timestamp: 10,
    });
    const completedAnswer = createMessage({
      id: "assistant-1",
      role: "assistant",
      text: "First answer",
      timestamp: 20,
    });
    const streamingUser = createMessage({
      id: "user-2",
      role: "user",
      text: "Second question",
      timestamp: 30,
    });
    const streamingPart = createMessage({
      id: "assistant-2",
      role: "assistant",
      text: "Second ans",
      status: "streaming",
      timestamp: 40,
    });

    const first = builder.build([
      completed,
      completedAnswer,
      streamingUser,
      streamingPart,
    ]);
    const second = builder.build([
      completed,
      completedAnswer,
      streamingUser,
      { ...streamingPart, text: "Second answer" },
    ]);

    // The completed turn is referentially identical; only the streaming
    // turn (whose message object changed) gets a new identity.
    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1]?.messages[0]?.text).toBe("Second answer");

    // Appending a new turn also preserves all prior completed turns.
    const third = builder.build([
      completed,
      completedAnswer,
      streamingUser,
      { ...streamingPart, text: "Second answer", status: "complete" },
      createMessage({ id: "user-3", role: "user", text: "Third question" }),
    ]);
    expect(third[0]).toBe(first[0]);
    expect(third).toHaveLength(3);
  });
});
