import type { AgentSnapshot, PiDesktopAgentEvent } from "@pi-desktop/shared";

import {
  addLiveMessageToTurn,
  applyLiveToolEvent,
  completeCurrentTurn,
  ensureCurrentLiveTurn,
  startLiveTurn,
} from "./agent-feed-live-state";
import type { AgentLiveFeed, AgentLiveTurn } from "./agent-feed-types";

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function addActivity(
  feed: AgentLiveFeed,
  event: PiDesktopAgentEvent,
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
  event: PiDesktopAgentEvent,
  receivedAt: number,
): AgentLiveFeed {
  const timestamp = "timestamp" in event ? event.timestamp : receivedAt;

  switch (event.type) {
    case "agent_start":
    case "agent_end":
      return addActivity(snapshot, event, timestamp, snapshot.currentTurnId);
    case "turn_start": {
      const nextTurn = startLiveTurn(snapshot, timestamp);

      return addActivity(nextTurn.feed, event, timestamp, nextTurn.turnId);
    }
    case "turn_end": {
      const completed = completeCurrentTurn(snapshot, timestamp);

      return addActivity(completed.feed, event, timestamp, completed.turnId);
    }
    case "message_start":
    case "message_update":
    case "message_end": {
      const ensured = ensureCurrentLiveTurn(snapshot, timestamp);
      const nextFeed = addLiveMessageToTurn(
        ensured.feed,
        ensured.turnId,
        event.messageId,
      );

      return addActivity(nextFeed, event, timestamp, ensured.turnId);
    }
    case "tool_execution_start": {
      const nextTool = applyLiveToolEvent(snapshot, event, timestamp);

      return addActivity(nextTool.feed, event, timestamp, nextTool.turnId);
    }
    case "tool_execution_update": {
      const nextTool = applyLiveToolEvent(snapshot, event, timestamp);

      return addActivity(nextTool.feed, event, timestamp, nextTool.turnId);
    }
    case "tool_execution_end": {
      const nextTool = applyLiveToolEvent(snapshot, event, timestamp);

      return addActivity(nextTool.feed, event, timestamp, nextTool.turnId);
    }
    default:
      return snapshot;
  }
}
