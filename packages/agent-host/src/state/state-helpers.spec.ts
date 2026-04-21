import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  PiDesktopAgentEvent,
} from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import { applyEventToSnapshot, upsertMessage } from "./state-helpers.js";

function makeMessage(
  overrides: Partial<AgentMessageSnapshot> = {},
): AgentMessageSnapshot {
  return {
    id: "msg-1",
    role: "assistant",
    text: "hello",
    status: "complete",
    timestamp: 1,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<AgentSnapshot> = {}): AgentSnapshot {
  return {
    sessionId: "session-1",
    status: "ready",
    messages: [],
    lastError: null,
    ...overrides,
  };
}

describe("upsertMessage", () => {
  it("appends when no existing message has the same id", () => {
    const existing = makeMessage({ id: "a" });
    const next = makeMessage({ id: "b", text: "world" });

    const result = upsertMessage([existing], next);

    expect(result).toEqual([existing, next]);
    expect(result).not.toBe([existing]);
  });

  it("replaces an existing message with matching id", () => {
    const existing = makeMessage({ id: "a", text: "old" });
    const other = makeMessage({ id: "b", text: "other" });
    const updated = makeMessage({ id: "a", text: "new" });

    const result = upsertMessage([existing, other], updated);

    expect(result).toEqual([updated, other]);
    expect(result[1]).toBe(other);
  });

  it("returns a new array even when no replacement happens", () => {
    const existing = makeMessage({ id: "a" });
    const messages = [existing];
    const next = makeMessage({ id: "b" });

    const result = upsertMessage(messages, next);

    expect(result).not.toBe(messages);
  });
});

describe("applyEventToSnapshot", () => {
  it("agent_start sets status to streaming", () => {
    const snapshot = makeSnapshot({ status: "ready" });
    const event: PiDesktopAgentEvent = { type: "agent_start" };

    expect(applyEventToSnapshot(snapshot, event).status).toBe("streaming");
  });

  it("agent_end sets status to ready", () => {
    const snapshot = makeSnapshot({ status: "streaming" });
    const event: PiDesktopAgentEvent = { type: "agent_end" };

    expect(applyEventToSnapshot(snapshot, event).status).toBe("ready");
  });

  it("message_start upserts a streaming message", () => {
    const snapshot = makeSnapshot();
    const event: PiDesktopAgentEvent = {
      type: "message_start",
      messageId: "m1",
      role: "assistant",
      text: "",
      timestamp: 42,
    };

    const result = applyEventToSnapshot(snapshot, event);

    expect(result.messages).toEqual([
      {
        id: "m1",
        role: "assistant",
        text: "",
        status: "streaming",
        timestamp: 42,
      },
    ]);
  });

  it("message_update replaces matching message in place", () => {
    const initial = makeMessage({
      id: "m1",
      text: "hi",
      status: "streaming",
      timestamp: 10,
    });
    const snapshot = makeSnapshot({ messages: [initial] });
    const event: PiDesktopAgentEvent = {
      type: "message_update",
      messageId: "m1",
      role: "assistant",
      text: "hi there",
      timestamp: 10,
    };

    const result = applyEventToSnapshot(snapshot, event);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.text).toBe("hi there");
    expect(result.messages[0]?.status).toBe("streaming");
  });

  it("message_end marks message complete and flips status to ready when no other streaming", () => {
    const initial = makeMessage({
      id: "m1",
      text: "partial",
      status: "streaming",
    });
    const snapshot = makeSnapshot({
      status: "streaming",
      messages: [initial],
    });
    const event: PiDesktopAgentEvent = {
      type: "message_end",
      messageId: "m1",
      role: "assistant",
      text: "final",
      timestamp: 100,
    };

    const result = applyEventToSnapshot(snapshot, event);

    expect(result.status).toBe("ready");
    expect(result.messages[0]).toMatchObject({
      id: "m1",
      text: "final",
      status: "complete",
    });
  });

  it("message_end keeps status when other messages are still streaming", () => {
    const ending = makeMessage({ id: "m1", status: "streaming" });
    const stillStreaming = makeMessage({ id: "m2", status: "streaming" });
    const snapshot = makeSnapshot({
      status: "streaming",
      messages: [ending, stillStreaming],
    });
    const event: PiDesktopAgentEvent = {
      type: "message_end",
      messageId: "m1",
      role: "assistant",
      text: "done",
      timestamp: 5,
    };

    const result = applyEventToSnapshot(snapshot, event);

    expect(result.status).toBe("streaming");
  });

  it("tool_execution_start adds a streaming tool message", () => {
    const snapshot = makeSnapshot();
    const event: PiDesktopAgentEvent = {
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "read",
      args: { path: "x" },
    };

    const result = applyEventToSnapshot(snapshot, event);

    expect(result.messages).toHaveLength(1);
    const msg = result.messages[0];
    expect(msg?.id).toBe("tool:read:call-1");
    expect(msg?.role).toBe("tool");
    expect(msg?.status).toBe("streaming");
    expect(msg?.text).toContain('"path": "x"');
  });

  it("tool_execution_end with isError marks message as error", () => {
    const snapshot = makeSnapshot();
    const startEvent: PiDesktopAgentEvent = {
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "bash",
      args: { cmd: "ls" },
    };
    const endEvent: PiDesktopAgentEvent = {
      type: "tool_execution_end",
      toolCallId: "call-1",
      toolName: "bash",
      result: "boom",
      isError: true,
    };

    const afterStart = applyEventToSnapshot(snapshot, startEvent);
    const afterEnd = applyEventToSnapshot(afterStart, endEvent);

    expect(afterEnd.messages).toHaveLength(1);
    expect(afterEnd.messages[0]?.status).toBe("error");
    expect(afterEnd.messages[0]?.text).toBe("boom");
  });

  it("tool_execution_update formats partialResult JSON and uses last message timestamp", () => {
    const lastMsg = makeMessage({ id: "prev", timestamp: 999 });
    const snapshot = makeSnapshot({ messages: [lastMsg] });
    const event: PiDesktopAgentEvent = {
      type: "tool_execution_update",
      toolCallId: "call-9",
      toolName: "search",
      args: { q: "x" },
      partialResult: { progress: 0.5 },
    };

    const result = applyEventToSnapshot(snapshot, event);

    const tool = result.messages.find((m) => m.id === "tool:search:call-9");
    expect(tool?.timestamp).toBe(999);
    expect(tool?.text).toContain('"progress": 0.5');
  });

  it("tool payload formatting handles strings, null, and undefined", () => {
    const snapshot = makeSnapshot();

    const stringEvent: PiDesktopAgentEvent = {
      type: "tool_execution_end",
      toolCallId: "c1",
      toolName: "t",
      result: "raw text",
      isError: false,
    };
    expect(applyEventToSnapshot(snapshot, stringEvent).messages[0]?.text).toBe(
      "raw text",
    );

    const nullEvent: PiDesktopAgentEvent = {
      type: "tool_execution_end",
      toolCallId: "c2",
      toolName: "t",
      result: null,
      isError: false,
    };
    expect(applyEventToSnapshot(snapshot, nullEvent).messages[0]?.text).toBe(
      "",
    );

    const undefinedEvent: PiDesktopAgentEvent = {
      type: "tool_execution_end",
      toolCallId: "c3",
      toolName: "t",
      result: undefined,
      isError: false,
    };
    expect(
      applyEventToSnapshot(snapshot, undefinedEvent).messages[0]?.text,
    ).toBe("");
  });

  it("falls back to String() when JSON serialization throws (e.g. cycles)", () => {
    type Cyclic = { self?: Cyclic };
    const cyclic: Cyclic = {};
    cyclic.self = cyclic;

    const snapshot = makeSnapshot();
    const event: PiDesktopAgentEvent = {
      type: "tool_execution_end",
      toolCallId: "c1",
      toolName: "t",
      result: cyclic,
      isError: false,
    };

    const result = applyEventToSnapshot(snapshot, event);
    expect(result.messages[0]?.text).toBe("[object Object]");
  });

  it("returns the same snapshot for unhandled event types", () => {
    const snapshot = makeSnapshot();
    const event: PiDesktopAgentEvent = { type: "session_changed" };

    expect(applyEventToSnapshot(snapshot, event)).toBe(snapshot);
  });
});
