import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  ContextUsageSnapshot,
} from "@pi-desktop/shared";

import { toSnapshotMessages } from "./pi-sdk-message-snapshot.js";

type SessionUsageLike = {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
};

type SessionSnapshotLike = {
  sessionId: string;
  messages: unknown[];
  getContextUsage?: () => SessionUsageLike | undefined;
};

function cloneSnapshotMessages(
  messages: AgentMessageSnapshot[],
): AgentMessageSnapshot[] {
  return messages.map((message) => ({ ...message }));
}

function getSdkContextUsage(
  session: Pick<SessionSnapshotLike, "getContextUsage"> | null,
): ContextUsageSnapshot | undefined {
  const sdkUsage =
    typeof session?.getContextUsage === "function"
      ? session.getContextUsage()
      : undefined;

  if (!sdkUsage) {
    return undefined;
  }

  return {
    tokens: sdkUsage.tokens,
    contextWindow: sdkUsage.contextWindow,
    percent: sdkUsage.percent,
  };
}

export function cloneSdkSnapshot(
  snapshot: AgentSnapshot,
  session: Pick<SessionSnapshotLike, "getContextUsage"> | null = null,
): AgentSnapshot {
  return {
    ...snapshot,
    messages: cloneSnapshotMessages(snapshot.messages),
    contextUsage: getSdkContextUsage(session),
  };
}

export function buildSdkSessionSnapshot(
  session: Pick<SessionSnapshotLike, "sessionId" | "messages">,
  status: AgentSnapshot["status"],
): AgentSnapshot {
  return {
    sessionId: session.sessionId,
    status,
    messages: toSnapshotMessages(session.messages),
    lastError: null,
  };
}

export function buildSdkErrorSnapshot(
  snapshot: AgentSnapshot,
  sessionId: string,
  error: unknown,
): AgentSnapshot {
  return {
    sessionId,
    status: "error",
    messages: snapshot.messages,
    lastError:
      error instanceof Error ? error.message : "Unknown Pi SDK runtime error",
  };
}
