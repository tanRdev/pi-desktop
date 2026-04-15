import type { AgentRuntimeStatus } from "./agent.js";

export type ThreadRuntimeStatus =
  | AgentRuntimeStatus
  | "disconnected"
  | "exited";

export interface ThreadRuntimeSnapshot {
  status: ThreadRuntimeStatus;
  lastError: string | null;
}

export interface ThreadSnapshot {
  id: string;
  title: string;
  isArchived: boolean;
  lastActivityAt: number | null;
  createdAt?: number;
  runtime: ThreadRuntimeSnapshot;
}
