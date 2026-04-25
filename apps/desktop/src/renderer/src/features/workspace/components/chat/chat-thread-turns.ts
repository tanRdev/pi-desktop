import type { AgentMessageSnapshot } from "@pi-desktop/shared";

export interface ChatThreadTurn {
  id: string;
  userMessage: AgentMessageSnapshot | null;
  messages: AgentMessageSnapshot[];
  lastAssistantTimestamp: number | null;
  isStreaming: boolean;
}

export function buildChatTurns(
  messages: AgentMessageSnapshot[],
): ChatThreadTurn[] {
  const turns: ChatThreadTurn[] = [];
  let current: ChatThreadTurn | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      if (current) {
        turns.push(current);
      }

      current = {
        id: message.id,
        userMessage: message,
        messages: [],
        lastAssistantTimestamp: null,
        isStreaming: false,
      };
      continue;
    }

    if (!current) {
      current = {
        id: `pre-turn-${message.id}`,
        userMessage: null,
        messages: [],
        lastAssistantTimestamp: null,
        isStreaming: false,
      };
    }

    current.messages.push(message);

    if (message.status === "streaming") {
      current.isStreaming = true;
      continue;
    }

    if (message.role === "assistant") {
      current.lastAssistantTimestamp = message.timestamp;
    }
  }

  if (current) {
    turns.push(current);
  }

  return turns;
}
