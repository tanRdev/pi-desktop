import type { AgentSnapshot, PiDesktopAgentEvent } from "@pi-desktop/shared";

import { safeJsonParse } from "./pi-cli-rpc-framing.js";
import { isRpcResponse } from "./pi-cli-rpc-protocol.js";

type PendingRequest = {
  command: string;
  resolve(value: unknown): void;
  reject(error: Error): void;
};

type HandleRpcLineInput = {
  line: string;
  snapshot: AgentSnapshot;
  pendingRequests: Map<string, PendingRequest>;
  setErrorState(message: string, sessionId: string): AgentSnapshot;
  normalizeEvent(value: unknown): PiDesktopAgentEvent | null;
  applyEvent(
    snapshot: AgentSnapshot,
    event: PiDesktopAgentEvent,
  ): AgentSnapshot;
};

type HandleRpcLineResult = {
  snapshot: AgentSnapshot;
  event: PiDesktopAgentEvent | null;
};

export function handleRpcLine({
  line,
  snapshot,
  pendingRequests,
  setErrorState,
  normalizeEvent,
  applyEvent,
}: HandleRpcLineInput): HandleRpcLineResult {
  const parsed = safeJsonParse(line);
  if (parsed === null) {
    return { snapshot, event: null };
  }

  if (isRpcResponse(parsed)) {
    const requestId = typeof parsed.id === "string" ? parsed.id : null;

    if (!requestId) {
      return { snapshot, event: null };
    }

    const pendingRequest = pendingRequests.get(requestId);

    if (!pendingRequest) {
      if (!parsed.success && parsed.command === "prompt") {
        return {
          snapshot: setErrorState(
            parsed.error ?? "Unknown Pi CLI RPC error",
            snapshot.sessionId,
          ),
          event: null,
        };
      }

      return { snapshot, event: null };
    }

    pendingRequests.delete(requestId);

    if (!parsed.success) {
      const message = parsed.error ?? `Pi RPC ${pendingRequest.command} failed`;
      pendingRequest.reject(new Error(message));
      if (pendingRequest.command === "prompt") {
        return {
          snapshot: setErrorState(message, snapshot.sessionId),
          event: null,
        };
      }
      return { snapshot, event: null };
    }

    pendingRequest.resolve(parsed.data);
    return { snapshot, event: null };
  }

  const normalized = normalizeEvent(parsed);

  if (!normalized) {
    return { snapshot, event: null };
  }

  return {
    snapshot: applyEvent(snapshot, normalized),
    event: normalized,
  };
}

export type { HandleRpcLineResult, PendingRequest };
