import type { PiDesktopAgentEvent } from "@pi-desktop/shared";

import type {
  AgentLiveFeed,
  AgentLiveTool,
  AgentLiveTurn,
} from "./agent-feed-types";

type LiveToolEvent = Extract<
  PiDesktopAgentEvent,
  | { type: "tool_execution_start" }
  | { type: "tool_execution_update" }
  | { type: "tool_execution_end" }
>;

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

function withToolLinkedToTurn(
  feed: AgentLiveFeed,
  turnId: string,
  toolCallId: string,
): AgentLiveFeed {
  return updateTurn(feed, turnId, (turn) => ({
    ...turn,
    toolCallIds: appendUnique(turn.toolCallIds, toolCallId),
  }));
}

function upsertTool(
  feed: AgentLiveFeed,
  toolCallId: string,
  nextTool: AgentLiveTool,
): AgentLiveFeed {
  return {
    ...feed,
    toolsById: {
      ...feed.toolsById,
      [toolCallId]: nextTool,
    },
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

function resolveTurnStatus(
  feed: AgentLiveFeed,
  turnId: string,
): AgentLiveTurn["status"] {
  const turn = feed.turns.find((candidate) => candidate.id === turnId);
  const hasToolError = turn?.toolCallIds.some(
    (toolCallId) => feed.toolsById[toolCallId]?.isError,
  );

  return hasToolError ? "error" : "complete";
}

export function startLiveTurn(
  feed: AgentLiveFeed,
  timestamp: number,
): { feed: AgentLiveFeed; turnId: string } {
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

export function ensureCurrentLiveTurn(
  feed: AgentLiveFeed,
  timestamp: number,
): { feed: AgentLiveFeed; turnId: string } {
  return ensureCurrentTurn(feed, timestamp);
}

export function addLiveMessageToTurn(
  feed: AgentLiveFeed,
  turnId: string,
  messageId: string,
): AgentLiveFeed {
  return updateTurn(feed, turnId, (turn) => ({
    ...turn,
    messageIds: appendUnique(turn.messageIds, messageId),
  }));
}

export function completeCurrentTurn(
  feed: AgentLiveFeed,
  timestamp: number,
): { feed: AgentLiveFeed; turnId: string | null } {
  if (!feed.currentTurnId) {
    return { feed, turnId: null };
  }

  const turnId = feed.currentTurnId;
  const completedFeed = updateTurn(feed, turnId, (turn) => ({
    ...turn,
    status: resolveTurnStatus(feed, turnId),
    endedAt: timestamp,
  }));

  return {
    turnId,
    feed: {
      ...completedFeed,
      currentTurnId: null,
    },
  };
}

export function applyLiveToolEvent(
  feed: AgentLiveFeed,
  event: LiveToolEvent,
  timestamp: number,
): { feed: AgentLiveFeed; turnId: string } {
  const ensured = ensureCurrentTurn(feed, timestamp);
  const currentTool = feed.toolsById[event.toolCallId];
  const turnLinkedFeed = withToolLinkedToTurn(
    ensured.feed,
    ensured.turnId,
    event.toolCallId,
  );

  switch (event.type) {
    case "tool_execution_start":
      return {
        turnId: ensured.turnId,
        feed: upsertTool(turnLinkedFeed, event.toolCallId, {
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
        }),
      };
    case "tool_execution_update":
      return {
        turnId: ensured.turnId,
        feed: upsertTool(turnLinkedFeed, event.toolCallId, {
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
        }),
      };
    case "tool_execution_end":
      return {
        turnId: ensured.turnId,
        feed: upsertTool(turnLinkedFeed, event.toolCallId, {
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
        }),
      };
  }
}
