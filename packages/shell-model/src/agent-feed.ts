import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  PiDeskAgentEvent,
} from "@pidesk/shared";

export interface AgentLiveTurn {
  id: string;
  status: "complete" | "error" | "running";
  startedAt: number;
  endedAt: number | null;
  messageIds: string[];
  toolCallIds: string[];
}

export interface AgentLiveTool {
  toolCallId: string;
  turnId: string | null;
  toolName: string;
  status: "complete" | "error" | "running";
  args: unknown;
  partialResult: unknown;
  result: unknown;
  startedAt: number;
  endedAt: number | null;
  isError: boolean;
}

export interface AgentActivityItem {
  id: string;
  type: PiDeskAgentEvent["type"];
  timestamp: number;
  turnId: string | null;
  messageId?: string;
  toolCallId?: string;
}

export interface AgentLiveFeed {
  currentTurnId: string | null;
  turns: AgentLiveTurn[];
  toolsById: Record<string, AgentLiveTool>;
  activity: AgentActivityItem[];
  lastEventSequence: number;
  lastEventTimestamp: number | null;
  snapshotLoadedAt: number | null;
}

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function nextLiveTurnId(turns: AgentLiveTurn[]): string {
  return `turn-${turns.filter((turn) => /^turn-\d+$/.test(turn.id)).length + 1}`;
}

function createTurn(id: string, startedAt: number): AgentLiveTurn {
  return {
    id,
    status: "running",
    startedAt,
    endedAt: null,
    messageIds: [],
    toolCallIds: [],
  };
}

function addActivity(
  feed: AgentLiveFeed,
  event: PiDeskAgentEvent,
  timestamp: number,
  turnId: string | null,
): AgentLiveFeed {
  return {
    ...feed,
    lastEventSequence: feed.lastEventSequence + 1,
    lastEventTimestamp: timestamp,
    activity: [
      ...feed.activity,
      {
        id: `activity-${feed.activity.length + 1}`,
        type: event.type,
        timestamp,
        turnId,
        ...("messageId" in event ? { messageId: event.messageId } : {}),
        ...("toolCallId" in event ? { toolCallId: event.toolCallId } : {}),
      },
    ],
  };
}

function ensureCurrentTurn(
  feed: AgentLiveFeed,
  timestamp: number,
): { feed: AgentLiveFeed; turnId: string } {
  if (feed.currentTurnId) {
    return { feed, turnId: feed.currentTurnId };
  }

  const turnId = nextLiveTurnId(feed.turns);

  return {
    turnId,
    feed: {
      ...feed,
      currentTurnId: turnId,
      turns: [...feed.turns, createTurn(turnId, timestamp)],
    },
  };
}

function updateTurn(
  feed: AgentLiveFeed,
  turnId: string,
  update: (turn: AgentLiveTurn) => AgentLiveTurn,
): AgentLiveFeed {
  return {
    ...feed,
    turns: feed.turns.map((turn) => (turn.id === turnId ? update(turn) : turn)),
  };
}

export function createInitialAgentLiveFeed(): AgentLiveFeed {
  return {
    currentTurnId: null,
    turns: [],
    toolsById: {},
    activity: [],
    lastEventSequence: 0,
    lastEventTimestamp: null,
    snapshotLoadedAt: null,
  };
}

export function createAgentLiveFeedFromSnapshot(
  snapshot: AgentSnapshot,
): AgentLiveFeed {
  const initial = createInitialAgentLiveFeed();

  if (snapshot.messages.length === 0) {
    return initial;
  }

  const turns: AgentLiveTurn[] = [];
  let currentTurn: AgentLiveTurn | null = null;

  for (const message of snapshot.messages) {
    const shouldStartNewTurn =
      currentTurn === null ||
      (message.role === "user" && currentTurn.messageIds.length > 0);

    if (shouldStartNewTurn) {
      if (currentTurn) {
        turns.push(currentTurn);
      }

      currentTurn = {
        id: `turn-history-${turns.length + 1}`,
        status: snapshot.status === "error" ? "error" : "complete",
        startedAt: message.timestamp,
        endedAt: message.timestamp,
        messageIds: [],
        toolCallIds: [],
      };
    }

    if (!currentTurn) {
      continue;
    }

    currentTurn.messageIds = appendUnique(currentTurn.messageIds, message.id);
    currentTurn.endedAt = message.timestamp;
  }

  if (currentTurn) {
    if (snapshot.status === "streaming") {
      currentTurn.status = "running";
    }

    turns.push(currentTurn);
  }

  return {
    ...initial,
    currentTurnId:
      snapshot.status === "streaming"
        ? turns.length > 0
          ? (turns[turns.length - 1]?.id ?? null)
          : null
        : null,
    turns,
    activity: snapshot.messages.map((message, index) => ({
      id: `activity-${index + 1}`,
      type: message.status === "streaming" ? "message_update" : "message_end",
      timestamp: message.timestamp,
      turnId:
        turns.find((turn) => turn.messageIds.includes(message.id))?.id ?? null,
      messageId: message.id,
    })),
  };
}

export function applyLiveAgentEvent(
  snapshot: AgentLiveFeed,
  event: PiDeskAgentEvent,
  receivedAt: number,
): AgentLiveFeed {
  const timestamp = "timestamp" in event ? event.timestamp : receivedAt;

  switch (event.type) {
    case "agent_start":
    case "agent_end":
      return addActivity(snapshot, event, timestamp, snapshot.currentTurnId);
    case "turn_start": {
      const nextTurnId = nextLiveTurnId(snapshot.turns);
      const nextFeed = {
        ...snapshot,
        currentTurnId: nextTurnId,
        turns: [...snapshot.turns, createTurn(nextTurnId, timestamp)],
      };

      return addActivity(nextFeed, event, timestamp, nextTurnId);
    }
    case "turn_end": {
      if (!snapshot.currentTurnId) {
        return addActivity(snapshot, event, timestamp, null);
      }

      const turnId = snapshot.currentTurnId;
      const nextStatus = snapshot.turns.some(
        (turn) =>
          turn.id === turnId &&
          turn.toolCallIds.some(
            (toolCallId) => snapshot.toolsById[toolCallId]?.isError,
          ),
      )
        ? "error"
        : "complete";
      const nextFeed = updateTurn(snapshot, turnId, (turn) => ({
        ...turn,
        status: nextStatus,
        endedAt: timestamp,
      }));

      return addActivity(
        {
          ...nextFeed,
          currentTurnId: null,
        },
        event,
        timestamp,
        turnId,
      );
    }
    case "message_start":
    case "message_update":
    case "message_end": {
      const ensured = ensureCurrentTurn(snapshot, timestamp);
      const nextFeed = updateTurn(ensured.feed, ensured.turnId, (turn) => ({
        ...turn,
        messageIds: appendUnique(turn.messageIds, event.messageId),
      }));

      return addActivity(nextFeed, event, timestamp, ensured.turnId);
    }
    case "tool_execution_start": {
      const ensured = ensureCurrentTurn(snapshot, timestamp);
      const nextFeed = updateTurn(ensured.feed, ensured.turnId, (turn) => ({
        ...turn,
        toolCallIds: appendUnique(turn.toolCallIds, event.toolCallId),
      }));

      return addActivity(
        {
          ...nextFeed,
          toolsById: {
            ...nextFeed.toolsById,
            [event.toolCallId]: {
              toolCallId: event.toolCallId,
              turnId: ensured.turnId,
              toolName: event.toolName,
              status: "running",
              args: event.args,
              partialResult: null,
              result: null,
              startedAt: timestamp,
              endedAt: null,
              isError: false,
            },
          },
        },
        event,
        timestamp,
        ensured.turnId,
      );
    }
    case "tool_execution_update": {
      const ensured = ensureCurrentTurn(snapshot, timestamp);
      const currentTool = snapshot.toolsById[event.toolCallId];
      const nextFeed = updateTurn(ensured.feed, ensured.turnId, (turn) => ({
        ...turn,
        toolCallIds: appendUnique(turn.toolCallIds, event.toolCallId),
      }));

      return addActivity(
        {
          ...nextFeed,
          toolsById: {
            ...nextFeed.toolsById,
            [event.toolCallId]: {
              toolCallId: event.toolCallId,
              turnId: currentTool?.turnId ?? ensured.turnId,
              toolName: event.toolName,
              status: currentTool?.status === "error" ? "error" : "running",
              args: event.args,
              partialResult: event.partialResult,
              result: currentTool?.result ?? null,
              startedAt: currentTool?.startedAt ?? timestamp,
              endedAt: currentTool?.endedAt ?? null,
              isError: currentTool?.isError ?? false,
            },
          },
        },
        event,
        timestamp,
        ensured.turnId,
      );
    }
    case "tool_execution_end": {
      const ensured = ensureCurrentTurn(snapshot, timestamp);
      const currentTool = snapshot.toolsById[event.toolCallId];
      const nextFeed = updateTurn(ensured.feed, ensured.turnId, (turn) => ({
        ...turn,
        toolCallIds: appendUnique(turn.toolCallIds, event.toolCallId),
      }));

      return addActivity(
        {
          ...nextFeed,
          toolsById: {
            ...nextFeed.toolsById,
            [event.toolCallId]: {
              toolCallId: event.toolCallId,
              turnId: currentTool?.turnId ?? ensured.turnId,
              toolName: event.toolName,
              status: event.isError ? "error" : "complete",
              args: currentTool?.args ?? null,
              partialResult: currentTool?.partialResult ?? null,
              result: event.result,
              startedAt: currentTool?.startedAt ?? timestamp,
              endedAt: timestamp,
              isError: event.isError,
            },
          },
        },
        event,
        timestamp,
        ensured.turnId,
      );
    }
    default:
      return snapshot;
  }
}

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

export function applyAgentEvent(
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
