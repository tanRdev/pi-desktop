import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";

import { normalizeAgentSessionEvent } from "../../../packages/agent-host/src/events/normalize-agent-session-event";

describe("normalizeAgentSessionEvent", () => {
  it("extracts streaming text deltas from Pi assistant message updates", () => {
    const timestamp = 123;
    const event: AgentSessionEvent = {
      type: "message_update",
      message: {
        role: "assistant",
        api: "openai-responses",
        provider: "openai",
        model: "mock-model",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
        stopReason: "stop",
        timestamp,
        content: [{ type: "text", text: "Hello there" }],
      },
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: " there",
        partial: {
          role: "assistant",
          api: "openai-responses",
          provider: "openai",
          model: "mock-model",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0,
          },
          stopReason: "stop",
          timestamp,
          content: [{ type: "text", text: "Hello there" }],
        },
      },
    };

    expect(normalizeAgentSessionEvent(event)).toEqual({
      type: "message_update",
      messageId: `assistant-${timestamp}`,
      role: "assistant",
      text: "Hello there",
      delta: " there",
      timestamp,
    });
  });

  it("preserves tool execution lifecycle events for the renderer", () => {
    const event: AgentSessionEvent = {
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "read",
      args: { filePath: "/tmp/example.ts" },
    };

    expect(normalizeAgentSessionEvent(event)).toEqual({
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "read",
      args: { filePath: "/tmp/example.ts" },
    });
  });
});
