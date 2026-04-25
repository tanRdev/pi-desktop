import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  PiDesktopAgentEvent,
} from "@pi-desktop/shared";

function upsertMessage(
  messages: AgentMessageSnapshot[],
  nextMessage: AgentMessageSnapshot,
): AgentMessageSnapshot[] {
  const index = messages.findIndex((message) => message.id === nextMessage.id);

  if (index === -1) {
    return [...messages, nextMessage];
  }

  return messages.map((message, currentIndex) =>
    currentIndex === index ? nextMessage : message,
  );
}

function formatToolPayload(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function createToolMessageId(toolName: string, toolCallId: string): string {
  return `tool:${toolName}:${toolCallId}`;
}

function createToolMessage(
  snapshot: AgentSnapshot,
  event: Extract<
    PiDesktopAgentEvent,
    | { type: "tool_execution_start" }
    | { type: "tool_execution_update" }
    | { type: "tool_execution_end" }
  >,
): AgentMessageSnapshot {
  const timestamp =
    snapshot.messages[snapshot.messages.length - 1]?.timestamp ?? Date.now();

  switch (event.type) {
    case "tool_execution_start":
      return {
        id: createToolMessageId(event.toolName, event.toolCallId),
        role: "tool",
        text: formatToolPayload(event.args),
        status: "streaming",
        timestamp,
      };
    case "tool_execution_update":
      return {
        id: createToolMessageId(event.toolName, event.toolCallId),
        role: "tool",
        text: formatToolPayload(event.partialResult),
        status: "streaming",
        timestamp,
      };
    case "tool_execution_end":
      return {
        id: createToolMessageId(event.toolName, event.toolCallId),
        role: "tool",
        text: formatToolPayload(event.result),
        status: event.isError ? "error" : "complete",
        timestamp,
      };
  }
}

export function applyAgentEvent(
  snapshot: AgentSnapshot,
  event: PiDesktopAgentEvent,
): AgentSnapshot {
  switch (event.type) {
    case "agent_start":
      return { ...snapshot, status: "streaming" };
    case "agent_end":
      return { ...snapshot, status: "ready" };
    case "message_start":
      return {
        ...snapshot,
        messages: upsertMessage(snapshot.messages, {
          id: event.messageId,
          role: event.role,
          text: event.text,
          status: "streaming",
          timestamp: event.timestamp,
        }),
      };
    case "message_update":
      return {
        ...snapshot,
        messages: upsertMessage(snapshot.messages, {
          id: event.messageId,
          role: event.role,
          text: event.text,
          status: "streaming",
          timestamp: event.timestamp,
        }),
      };
    case "message_end":
      return {
        ...snapshot,
        status: snapshot.messages.some(
          (message) =>
            message.id !== event.messageId && message.status === "streaming",
        )
          ? snapshot.status
          : "ready",
        messages: upsertMessage(snapshot.messages, {
          id: event.messageId,
          role: event.role,
          text: event.text,
          status: "complete",
          timestamp: event.timestamp,
        }),
      };
    case "tool_execution_start":
    case "tool_execution_update":
    case "tool_execution_end":
      return {
        ...snapshot,
        messages: upsertMessage(
          snapshot.messages,
          createToolMessage(snapshot, event),
        ),
      };
    default:
      return snapshot;
  }
}
