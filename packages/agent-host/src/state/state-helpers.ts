import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  PiDeskAgentEvent,
} from "@pidesk/shared";

/**
 * Inserts or updates a message in the messages array.
 * If a message with the same id exists, it replaces that message.
 * Otherwise, it appends the new message to the end.
 */
export function upsertMessage(
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

/**
 * Applies an agent event to an agent snapshot, returning a new snapshot.
 * Handles message lifecycle events (start, update, end) and agent state changes.
 */
export function applyEventToSnapshot(
  snapshot: AgentSnapshot,
  event: PiDeskAgentEvent,
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
        messages: upsertMessage(snapshot.messages, {
          id: event.messageId,
          role: event.role,
          text: event.text,
          status: "complete",
          timestamp: event.timestamp,
        }),
      };
    default:
      return snapshot;
  }
}
