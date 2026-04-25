import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type { AgentSnapshot, PiDesktopAgentEvent } from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";

import { normalizeAgentSessionEvent } from "../events/normalize-agent-session-event.js";
import { applyEventToSnapshot } from "../state/state-helpers.js";

type PendingRequest = {
  command: string;
  resolve(value: unknown): void;
  reject(error: Error): void;
};

type HandleRpcLine = (input: {
  line: string;
  snapshot: AgentSnapshot;
  pendingRequests: Map<string, PendingRequest>;
  setErrorState(message: string, sessionId: string): AgentSnapshot;
  normalizeEvent(value: unknown): PiDesktopAgentEvent | null;
  applyEvent(
    snapshot: AgentSnapshot,
    event: PiDesktopAgentEvent,
  ): AgentSnapshot;
}) => {
  snapshot: AgentSnapshot;
  event: PiDesktopAgentEvent | null;
};

function isHandleRpcLine(value: unknown): value is HandleRpcLine {
  return typeof value === "function";
}

async function loadHandleRpcLine(): Promise<HandleRpcLine | null> {
  try {
    const module = await import("./pi-cli-rpc-line-handler.js");
    return isHandleRpcLine(module.handleRpcLine) ? module.handleRpcLine : null;
  } catch {
    return null;
  }
}

function isMessageUpdateEvent(
  value: unknown,
): value is Extract<AgentSessionEvent, { type: "message_update" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "message_update" &&
    "message" in value &&
    "assistantMessageEvent" in value
  );
}

describe("handleRpcLine", () => {
  it("returns an error snapshot when a pending prompt response fails", async () => {
    const handleRpcLine = await loadHandleRpcLine();

    expect(handleRpcLine).not.toBeNull();

    if (!handleRpcLine) {
      return;
    }

    const snapshot: AgentSnapshot = {
      sessionId: "cli-session",
      status: "starting",
      messages: [],
      lastError: null,
    };
    const reject = vi.fn();
    const pendingRequests = new Map<string, PendingRequest>([
      [
        "request-1",
        {
          command: "prompt",
          resolve: vi.fn(),
          reject,
        },
      ],
    ]);

    const result = handleRpcLine({
      line: JSON.stringify({
        type: "response",
        id: "request-1",
        command: "prompt",
        success: false,
        error: "model unavailable",
      }),
      snapshot,
      pendingRequests,
      setErrorState: (message, sessionId) => ({
        ...snapshot,
        sessionId,
        status: "error",
        lastError: message,
      }),
      normalizeEvent: () => null,
      applyEvent: (currentSnapshot) => currentSnapshot,
    });

    expect(reject).toHaveBeenCalledOnce();
    expect(result.snapshot).toEqual({
      ...snapshot,
      status: "error",
      lastError: "model unavailable",
    });
  });

  it("applies agent message updates to the snapshot and emits the normalized event", async () => {
    const handleRpcLine = await loadHandleRpcLine();

    expect(handleRpcLine).not.toBeNull();

    if (!handleRpcLine) {
      return;
    }

    const snapshot: AgentSnapshot = {
      sessionId: "cli-session",
      status: "streaming",
      messages: [],
      lastError: null,
    };

    const nextSnapshot = handleRpcLine({
      line: JSON.stringify({
        type: "message_update",
        message: {
          role: "assistant",
          timestamp: 101,
          content: [{ type: "text", text: "cli reply" }],
        },
        assistantMessageEvent: {
          type: "text_delta",
          contentIndex: 0,
          delta: "cli reply",
        },
      }),
      snapshot,
      pendingRequests: new Map(),
      setErrorState: (message, sessionId) => ({
        ...snapshot,
        sessionId,
        status: "error",
        lastError: message,
      }),
      normalizeEvent: (value) => {
        if (!isMessageUpdateEvent(value)) {
          return null;
        }

        return normalizeAgentSessionEvent(value);
      },
      applyEvent: applyEventToSnapshot,
    });

    expect(nextSnapshot.event).toEqual({
      type: "message_update",
      messageId: "assistant-101",
      role: "assistant",
      text: "cli reply",
      delta: "cli reply",
      timestamp: 101,
    });
    expect(nextSnapshot.snapshot).toEqual({
      sessionId: "cli-session",
      status: "streaming",
      messages: [
        {
          id: "assistant-101",
          role: "assistant",
          text: "cli reply",
          status: "streaming",
          timestamp: 101,
        },
      ],
      lastError: null,
    });
  });
});
