import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";

import type { AgentMessageRole, PiDeskAgentEvent } from "@pidesk/shared";

function isStructuredMessage(value: unknown): value is {
  role: string;
  timestamp: number;
  content?: Array<{ type?: string; text?: string }>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    "timestamp" in value
  );
}

function toRole(role: string): AgentMessageRole | null {
  if (role === "assistant" || role === "system" || role === "user") {
    return role;
  }

  if (role === "toolResult") {
    return "tool";
  }

  return null;
}

function getMessageText(value: unknown): string {
  if (!isStructuredMessage(value) || !Array.isArray(value.content)) {
    return "";
  }

  return value.content
    .flatMap((item) =>
      item && typeof item.text === "string" ? [item.text] : [],
    )
    .join("");
}

function getMessageId(value: unknown): string | null {
  if (!isStructuredMessage(value)) {
    return null;
  }

  const role = toRole(value.role);

  if (!role) {
    return null;
  }

  return `${role}-${value.timestamp}`;
}

export function normalizeAgentSessionEvent(
  event: AgentSessionEvent,
): PiDeskAgentEvent | null {
  switch (event.type) {
    case "agent_start":
      return { type: "agent_start" };
    case "agent_end":
      return { type: "agent_end" };
    case "turn_start":
      return { type: "turn_start" };
    case "turn_end":
      return { type: "turn_end" };
    case "message_start":
    case "message_end": {
      const role = isStructuredMessage(event.message)
        ? toRole(event.message.role)
        : null;
      const messageId = getMessageId(event.message);

      if (!role || !messageId) {
        return null;
      }

      return {
        type: event.type,
        messageId,
        role,
        text: getMessageText(event.message),
        timestamp: event.message.timestamp,
      };
    }
    case "message_update": {
      const role = isStructuredMessage(event.message)
        ? toRole(event.message.role)
        : null;
      const messageId = getMessageId(event.message);

      if (!role || !messageId) {
        return null;
      }

      const delta =
        event.assistantMessageEvent.type === "text_delta" ||
        event.assistantMessageEvent.type === "thinking_delta"
          ? event.assistantMessageEvent.delta
          : undefined;

      return {
        type: "message_update",
        messageId,
        role,
        text: getMessageText(event.message),
        delta,
        timestamp: event.message.timestamp,
      };
    }
    case "tool_execution_start":
      return {
        type: "tool_execution_start",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      };
    case "tool_execution_update":
      return {
        type: "tool_execution_update",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        partialResult: event.partialResult,
      };
    case "tool_execution_end":
      return {
        type: "tool_execution_end",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      };
    default:
      return null;
  }
}
