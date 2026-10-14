import type { AgentMessageSnapshot, AgentSnapshot } from "@pi-desktop/shared";

const MESSAGE_STATUS_PRIORITY = {
  error: 3,
  complete: 2,
  streaming: 1,
} satisfies Record<AgentMessageSnapshot["status"], number>;

function pickPreferredMessage(
  current: AgentMessageSnapshot,
  incoming: AgentMessageSnapshot,
): AgentMessageSnapshot {
  if (incoming.timestamp > current.timestamp) {
    return incoming;
  }

  if (incoming.timestamp < current.timestamp) {
    return current;
  }

  const currentPriority = MESSAGE_STATUS_PRIORITY[current.status];
  const incomingPriority = MESSAGE_STATUS_PRIORITY[incoming.status];

  if (incomingPriority > currentPriority) {
    return incoming;
  }

  if (incomingPriority < currentPriority) {
    return current;
  }

  return incoming.text.length >= current.text.length ? incoming : current;
}

function determineAgentStatus(
  current: AgentSnapshot,
  incoming: AgentSnapshot,
  preserveLiveState: boolean,
  hasStreamingMessages: boolean,
): AgentSnapshot["status"] {
  if (incoming.status === "error") {
    return incoming.status;
  }

  if (hasStreamingMessages) {
    return "streaming";
  }

  if (preserveLiveState) {
    if (current.status === "starting") {
      return incoming.status;
    }
    return current.status;
  }

  return incoming.status;
}

export function mergeAgentSnapshots(
  current: AgentSnapshot,
  incoming: AgentSnapshot,
  preserveLiveState: boolean,
  promptError: unknown,
): AgentSnapshot {
  const messagesById = new Map<string, AgentMessageSnapshot>();

  for (const message of current.messages) {
    messagesById.set(message.id, message);
  }

  for (const message of incoming.messages) {
    const existing = messagesById.get(message.id);
    messagesById.set(
      message.id,
      existing ? pickPreferredMessage(existing, message) : message,
    );
  }

  const messages = [...messagesById.values()].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
  const hasStreamingMessages = messages.some(
    (message) => message.status === "streaming",
  );
  const status = determineAgentStatus(
    current,
    incoming,
    preserveLiveState,
    hasStreamingMessages,
  );

  return {
    sessionId: incoming.sessionId || current.sessionId,
    status,
    messages,
    lastError:
      incoming.lastError ??
      (promptError instanceof Error
        ? promptError.message
        : status === "error"
          ? current.lastError
          : null),
    contextUsage: incoming.contextUsage ?? current.contextUsage,
  };
}
