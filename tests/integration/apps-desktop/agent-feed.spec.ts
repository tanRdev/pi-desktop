import { describe, expect, it } from "vitest";
import type {
  AgentSnapshot,
  PiDeskAgentEvent,
} from "../../../packages/shared/src";
import {
  applyAgentEvent,
  applyLiveAgentEvent,
  createAgentLiveFeedFromSnapshot,
  createInitialAgentLiveFeed,
} from "../../../packages/shell-model/src";

describe("applyAgentEvent", () => {
  it("creates and completes streaming assistant messages", () => {
    const initial: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };

    const started = applyAgentEvent(initial, {
      type: "message_start",
      messageId: "assistant-1",
      role: "assistant",
      text: "",
      timestamp: 1,
    });

    const updated = applyAgentEvent(started, {
      type: "message_update",
      messageId: "assistant-1",
      role: "assistant",
      text: "Streaming message",
      delta: "message",
      timestamp: 1,
    });

    const completed = applyAgentEvent(updated, {
      type: "message_end",
      messageId: "assistant-1",
      role: "assistant",
      text: "Streaming message",
      timestamp: 1,
    });

    expect(started.messages).toEqual([
      {
        id: "assistant-1",
        role: "assistant",
        text: "",
        status: "streaming",
        timestamp: 1,
      },
    ]);
    expect(updated.messages[0]).toMatchObject({
      text: "Streaming message",
      status: "streaming",
    });
    expect(completed.messages[0]).toMatchObject({
      text: "Streaming message",
      status: "complete",
    });
  });

  it("tracks runtime status transitions from agent lifecycle events", () => {
    const initial: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };

    const events: PiDeskAgentEvent[] = [
      { type: "agent_start" },
      { type: "agent_end" },
    ];

    const finalState = events.reduce(applyAgentEvent, initial);

    expect(finalState.status).toBe("ready");
  });

  it("creates transcript tool messages from tool execution lifecycle events", () => {
    const initial: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };

    const started = applyAgentEvent(initial, {
      type: "tool_execution_start",
      toolCallId: "tool-1",
      toolName: "read",
      args: { filePath: "/tmp/example.ts" },
    });
    const updated = applyAgentEvent(started, {
      type: "tool_execution_update",
      toolCallId: "tool-1",
      toolName: "read",
      args: { filePath: "/tmp/example.ts" },
      partialResult: { status: "reading" },
    });
    const completed = applyAgentEvent(updated, {
      type: "tool_execution_end",
      toolCallId: "tool-1",
      toolName: "read",
      result: { content: "hello" },
      isError: false,
    });

    expect(started.messages).toEqual([
      {
        id: "tool:read:tool-1",
        role: "tool",
        text: '{\n  "filePath": "/tmp/example.ts"\n}',
        status: "streaming",
        timestamp: expect.any(Number),
      },
    ]);
    expect(updated.messages[0]).toMatchObject({
      id: "tool:read:tool-1",
      role: "tool",
      text: '{\n  "status": "reading"\n}',
      status: "streaming",
    });
    expect(completed.messages[0]).toMatchObject({
      id: "tool:read:tool-1",
      role: "tool",
      text: '{\n  "content": "hello"\n}',
      status: "complete",
    });
  });

  it("hydrates a historical turn from an existing snapshot", () => {
    const snapshot: AgentSnapshot = {
      sessionId: "sdk-session",
      status: "ready",
      messages: [
        {
          id: "user-1",
          role: "user",
          text: "Summarize the workspace",
          status: "complete",
          timestamp: 10,
        },
        {
          id: "assistant-2",
          role: "assistant",
          text: "Workspace summary ready.",
          status: "complete",
          timestamp: 11,
        },
      ],
      lastError: null,
    };

    const live = createAgentLiveFeedFromSnapshot(snapshot);

    expect(live.turns).toEqual([
      {
        id: "turn-history-1",
        status: "complete",
        startedAt: 10,
        endedAt: 11,
        messageIds: ["user-1", "assistant-2"],
        toolCallIds: [],
      },
    ]);
    expect(live.activity).toHaveLength(2);
    expect(live.currentTurnId).toBeNull();
  });

  it("tracks turns, tools, and activity timeline entries", () => {
    const initial = createInitialAgentLiveFeed();

    const startedTurn = applyLiveAgentEvent(
      initial,
      { type: "turn_start" },
      100,
    );
    const startedMessage = applyLiveAgentEvent(
      startedTurn,
      {
        type: "message_start",
        messageId: "assistant-1",
        role: "assistant",
        text: "",
        timestamp: 101,
      },
      101,
    );
    const startedTool = applyLiveAgentEvent(
      startedMessage,
      {
        type: "tool_execution_start",
        toolCallId: "tool-1",
        toolName: "workspace.inspect",
        args: { prompt: "Summarize the workspace" },
      },
      102,
    );
    const updatedTool = applyLiveAgentEvent(
      startedTool,
      {
        type: "tool_execution_update",
        toolCallId: "tool-1",
        toolName: "workspace.inspect",
        args: { prompt: "Summarize the workspace" },
        partialResult: { status: "reading" },
      },
      103,
    );
    const completedTool = applyLiveAgentEvent(
      updatedTool,
      {
        type: "tool_execution_end",
        toolCallId: "tool-1",
        toolName: "workspace.inspect",
        result: { status: "ok" },
        isError: false,
      },
      104,
    );
    const completedTurn = applyLiveAgentEvent(
      completedTool,
      { type: "turn_end" },
      105,
    );

    expect(completedTurn.currentTurnId).toBeNull();
    expect(completedTurn.turns).toEqual([
      {
        id: "turn-1",
        status: "complete",
        startedAt: 100,
        endedAt: 105,
        messageIds: ["assistant-1"],
        toolCallIds: ["tool-1"],
      },
    ]);
    expect(completedTurn.toolsById["tool-1"]).toMatchObject({
      toolCallId: "tool-1",
      turnId: "turn-1",
      toolName: "workspace.inspect",
      status: "complete",
      partialResult: { status: "reading" },
      result: { status: "ok" },
      isError: false,
      startedAt: 102,
      endedAt: 104,
    });
    expect(completedTurn.activity.map((entry) => entry.type)).toEqual([
      "turn_start",
      "message_start",
      "tool_execution_start",
      "tool_execution_update",
      "tool_execution_end",
      "turn_end",
    ]);
  });

  it("handles out-of-order tool updates without losing context", () => {
    const initial = createInitialAgentLiveFeed();

    const updated = applyLiveAgentEvent(
      initial,
      {
        type: "tool_execution_update",
        toolCallId: "tool-2",
        toolName: "reply.compose",
        args: { prompt: "Ship the redesign" },
        partialResult: { draft: "Working" },
      },
      120,
    );

    expect(updated.turns).toEqual([
      {
        id: "turn-1",
        status: "running",
        startedAt: 120,
        endedAt: null,
        messageIds: [],
        toolCallIds: ["tool-2"],
      },
    ]);
    expect(updated.toolsById["tool-2"]).toMatchObject({
      toolCallId: "tool-2",
      turnId: "turn-1",
      toolName: "reply.compose",
      status: "running",
      partialResult: { draft: "Working" },
      startedAt: 120,
      endedAt: null,
    });
  });
});
