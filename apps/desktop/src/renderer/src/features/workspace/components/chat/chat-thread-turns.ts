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

function isSameTurn(left: ChatThreadTurn, right: ChatThreadTurn): boolean {
  return (
    left.id === right.id &&
    left.userMessage === right.userMessage &&
    left.lastAssistantTimestamp === right.lastAssistantTimestamp &&
    left.isStreaming === right.isStreaming &&
    left.messages.length === right.messages.length &&
    left.messages.every((message, index) => message === right.messages[index])
  );
}

export interface ChatTurnsBuilder {
  build: (messages: AgentMessageSnapshot[]) => ChatThreadTurn[];
}

/**
 * Incremental turn builder (issue #11): turns whose source messages are
 * unchanged keep their object identity across rebuilds — e.g. while the
 * last turn streams, every completed turn stays referentially stable, so
 * memoized turn rows skip re-rendering and virtualization anchors keyed
 * by turn id remain meaningful. Hold one builder per mounted thread.
 */
export function createChatTurnsBuilder(): ChatTurnsBuilder {
  let previous: ChatThreadTurn[] = [];

  return {
    build(messages) {
      const next = buildChatTurns(messages);
      const reconciled = next.map((turn, index) => {
        const prior = previous[index];
        return prior && isSameTurn(prior, turn) ? prior : turn;
      });
      previous = reconciled;
      return reconciled;
    },
  };
}
