export type RpcStateLike = {
  model?: {
    id: string;
    name?: string;
    provider: string;
    reasoning?: boolean;
    input?: string[];
    contextWindow?: number;
    maxTokens?: number;
  };
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  isStreaming: boolean;
  sessionId: string;
};

export type RpcResponseLike = {
  id?: string;
  type: "response";
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
};

export type RpcMessageLike = {
  role: string;
  timestamp: number;
  content?: unknown;
  summary?: unknown;
  command?: unknown;
  output?: unknown;
  usage?: unknown;
  stopReason?: unknown;
};

export type RpcUsageLike = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isRpcResponse(value: unknown): value is RpcResponseLike {
  return (
    isRecord(value) &&
    value.type === "response" &&
    typeof value.command === "string" &&
    typeof value.success === "boolean"
  );
}

export function isRpcMessage(value: unknown): value is RpcMessageLike {
  return (
    isRecord(value) &&
    typeof value.role === "string" &&
    typeof value.timestamp === "number"
  );
}

export function isRpcUsage(value: unknown): value is RpcUsageLike {
  return (
    isRecord(value) &&
    typeof value.input === "number" &&
    typeof value.output === "number" &&
    typeof value.cacheRead === "number" &&
    typeof value.cacheWrite === "number" &&
    (value.totalTokens === undefined || typeof value.totalTokens === "number")
  );
}

export function createExitError(
  code: number | null,
  signal: NodeJS.Signals | null,
): Error {
  return new Error(
    `Pi CLI RPC process exited (${code ?? signal ?? "unknown"})`,
  );
}

export function parseRpcState(value: unknown): RpcStateLike {
  if (!isRecord(value) || typeof value.sessionId !== "string") {
    throw new Error("Pi RPC returned invalid session state");
  }

  return {
    model:
      isRecord(value.model) &&
      typeof value.model.id === "string" &&
      typeof value.model.provider === "string"
        ? {
            id: value.model.id,
            name:
              typeof value.model.name === "string"
                ? value.model.name
                : undefined,
            provider: value.model.provider,
            reasoning:
              typeof value.model.reasoning === "boolean"
                ? value.model.reasoning
                : undefined,
            input: Array.isArray(value.model.input)
              ? value.model.input.filter(
                  (entry): entry is string => typeof entry === "string",
                )
              : undefined,
            contextWindow:
              typeof value.model.contextWindow === "number"
                ? value.model.contextWindow
                : undefined,
            maxTokens:
              typeof value.model.maxTokens === "number"
                ? value.model.maxTokens
                : undefined,
          }
        : undefined,
    thinkingLevel:
      value.thinkingLevel === "off" ||
      value.thinkingLevel === "minimal" ||
      value.thinkingLevel === "low" ||
      value.thinkingLevel === "medium" ||
      value.thinkingLevel === "high" ||
      value.thinkingLevel === "xhigh"
        ? value.thinkingLevel
        : undefined,
    isStreaming: value.isStreaming === true,
    sessionId: value.sessionId,
  };
}

export function parseRpcMessagesResponse(value: unknown): RpcMessageLike[] {
  if (!isRecord(value)) {
    return [];
  }

  return (Array.isArray(value.messages) ? value.messages : []).flatMap(
    (message) => (isRpcMessage(message) ? [message] : []),
  );
}
