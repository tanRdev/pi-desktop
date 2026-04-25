import type { PiDesktopAgentEvent } from "@pi-desktop/shared";

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
  type: PiDesktopAgentEvent["type"];
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
