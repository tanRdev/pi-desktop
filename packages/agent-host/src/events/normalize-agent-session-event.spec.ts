import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";

import { normalizeAgentSessionEvent } from "./normalize-agent-session-event.js";

const stubUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function makeAssistantMessage(
  timestamp: number,
  contentText?: string | string[],
) {
  const content =
    typeof contentText === "string"
      ? [textContent(contentText)]
      : Array.isArray(contentText)
        ? contentText.map(textContent)
        : [];
  return {
    role: "assistant" as const,
    timestamp,
    content,
    api: "anthropic-messages" as const,
    provider: "anthropic" as const,
    model: "test-model",
    usage: stubUsage,
    stopReason: "stop" as const,
  };
}

function makeToolResultMessage(timestamp: number, contentText: string) {
  return {
    role: "toolResult" as const,
    toolCallId: "tc-stub",
    toolName: "stub",
    content: [textContent(contentText)],
    isError: false,
    timestamp,
  };
}

function makeUserMessage(timestamp: number, contentText: string) {
  return {
    role: "user" as const,
    content: contentText,
    timestamp,
  };
}

function makeTextDeltaEvent(
  delta: string,
): Extract<
  AgentSessionEvent,
  { type: "message_update" }
>["assistantMessageEvent"] & { delta: string } {
  return {
    type: "text_delta",
    contentIndex: 0,
    delta,
    partial: makeAssistantMessage(0),
  };
}

function makeThinkingDeltaEvent(
  delta: string,
): Extract<
  AgentSessionEvent,
  { type: "message_update" }
>["assistantMessageEvent"] & { delta: string } {
  return {
    type: "thinking_delta",
    contentIndex: 0,
    delta,
    partial: makeAssistantMessage(0),
  };
}

function makeToolCallStartEvent(): Extract<
  AgentSessionEvent,
  { type: "message_update" }
>["assistantMessageEvent"] {
  return {
    type: "toolcall_start",
    contentIndex: 0,
    partial: makeAssistantMessage(0),
  };
}

describe("normalizeAgentSessionEvent", () => {
  it("passes through lifecycle events without payload", () => {
    for (const type of [
      "agent_start",
      "agent_end",
      "turn_start",
      "turn_end",
    ] as const) {
      // @ts-expect-error - loop widens union; individual variants lack extra required fields
      const out = normalizeAgentSessionEvent({ type });
      expect(out).toEqual({ type });
    }
  });

  it("normalizes message_start with assistant role and concatenated text", () => {
    const out = normalizeAgentSessionEvent({
      type: "message_start",
      message: makeAssistantMessage(1234, ["hello ", "world"]),
    });

    expect(out).toEqual({
      type: "message_start",
      messageId: "assistant-1234",
      role: "assistant",
      text: "hello world",
      timestamp: 1234,
    });
  });

  it("maps toolResult role to 'tool'", () => {
    const out = normalizeAgentSessionEvent({
      type: "message_end",
      message: makeToolResultMessage(5, "ok"),
    });

    expect(out).toMatchObject({
      type: "message_end",
      role: "tool",
      messageId: "tool-5",
      text: "ok",
    });
  });

  it("returns null for unknown roles", () => {
    expect(
      normalizeAgentSessionEvent({
        type: "message_start",
        // @ts-expect-error - structural double for AgentMessage
        message: { role: "mystery", timestamp: 1 },
      }),
    ).toBeNull();
  });

  it("returns null when message is not a structured object", () => {
    expect(
      normalizeAgentSessionEvent({
        type: "message_end",
        // @ts-expect-error - intentionally non-object message payload
        message: "not-a-message",
      }),
    ).toBeNull();
  });

  it("returns empty text when content is missing or non-array", () => {
    expect(
      normalizeAgentSessionEvent({
        type: "message_start",
        message: makeUserMessage(7, ""),
      }),
    ).toMatchObject({
      type: "message_start",
      role: "user",
      messageId: "user-7",
      text: "",
    });
  });

  it("message_update extracts delta from text_delta events", () => {
    const out = normalizeAgentSessionEvent({
      type: "message_update",
      message: makeAssistantMessage(100, "abc"),
      assistantMessageEvent: makeTextDeltaEvent("c"),
    });

    expect(out).toEqual({
      type: "message_update",
      messageId: "assistant-100",
      role: "assistant",
      text: "abc",
      delta: "c",
      timestamp: 100,
    });
  });

  it("message_update extracts delta from thinking_delta events", () => {
    expect(
      normalizeAgentSessionEvent({
        type: "message_update",
        message: makeAssistantMessage(200, "thinking"),
        assistantMessageEvent: makeThinkingDeltaEvent(" more"),
      }),
    ).toMatchObject({
      type: "message_update",
      delta: " more",
    });
  });

  it("message_update leaves delta undefined for unrelated assistant events", () => {
    const out = normalizeAgentSessionEvent({
      type: "message_update",
      message: makeAssistantMessage(200, "x"),
      assistantMessageEvent: makeToolCallStartEvent(),
    });

    expect(out).toMatchObject({ type: "message_update" });
    expect(out && "delta" in out ? out.delta : "missing").toBeUndefined();
  });

  it("normalizes tool_execution_start", () => {
    expect(
      normalizeAgentSessionEvent({
        type: "tool_execution_start",
        toolCallId: "tc-1",
        toolName: "read",
        args: { path: "x" },
      }),
    ).toEqual({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "read",
      args: { path: "x" },
    });
  });

  it("normalizes tool_execution_update", () => {
    expect(
      normalizeAgentSessionEvent({
        type: "tool_execution_update",
        toolCallId: "tc-2",
        toolName: "bash",
        args: { cmd: "ls" },
        partialResult: { progress: 0.5 },
      }),
    ).toEqual({
      type: "tool_execution_update",
      toolCallId: "tc-2",
      toolName: "bash",
      args: { cmd: "ls" },
      partialResult: { progress: 0.5 },
    });
  });

  it("normalizes tool_execution_end", () => {
    expect(
      normalizeAgentSessionEvent({
        type: "tool_execution_end",
        toolCallId: "tc-3",
        toolName: "bash",
        result: { stdout: "" },
        isError: false,
      }),
    ).toEqual({
      type: "tool_execution_end",
      toolCallId: "tc-3",
      toolName: "bash",
      result: { stdout: "" },
      isError: false,
    });
  });

  it("returns null for unsupported event types", () => {
    expect(
      normalizeAgentSessionEvent({
        type: "auto_compaction_start",
        reason: "threshold",
      }),
    ).toBeNull();
  });
});
