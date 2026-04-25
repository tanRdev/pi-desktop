import type { AgentSnapshot } from "@pi-desktop/shared";

import {
  parseRpcMessagesResponse,
  parseRpcState,
  type RpcStateLike,
} from "./pi-cli-rpc-protocol.js";
import { getContextUsage, toSnapshotMessages } from "./pi-cli-rpc-snapshot.js";

type SendCommand = (command: { type: string }) => Promise<unknown>;

type RefreshCliRpcSnapshotOptions = {
  sendCommand: SendCommand;
};

type RefreshedCliRpcSnapshot = {
  rpcState: RpcStateLike;
  snapshot: AgentSnapshot;
};

export async function refreshCliRpcSnapshot({
  sendCommand,
}: RefreshCliRpcSnapshotOptions): Promise<RefreshedCliRpcSnapshot> {
  const [stateResponse, messagesResponse] = await Promise.all([
    sendCommand({ type: "get_state" }),
    sendCommand({ type: "get_messages" }),
  ]);

  const rpcState = parseRpcState(stateResponse);
  const rpcMessages = parseRpcMessagesResponse(messagesResponse);

  return {
    rpcState,
    snapshot: {
      sessionId: rpcState.sessionId,
      status: rpcState.isStreaming ? "streaming" : "ready",
      messages: toSnapshotMessages(rpcMessages),
      lastError: null,
      currentProviderId: rpcState.model?.provider,
      currentModelId: rpcState.model?.id,
      contextUsage: getContextUsage(rpcMessages, rpcState.model?.contextWindow),
    },
  };
}
