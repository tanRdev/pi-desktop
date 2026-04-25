import type {
  AgentMessageSnapshot,
  ContextUsageSnapshot,
  ModelSnapshot,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";

import {
  isRpcUsage,
  type RpcMessageLike,
  type RpcStateLike,
  type RpcUsageLike,
} from "./pi-cli-rpc-protocol.js";
import { mapThinkingLevel } from "./pi-thinking-level.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getTextBlockText(block: unknown): string {
  if (!isRecord(block) || typeof block.type !== "string") {
    return "";
  }

  if (block.type === "text" && typeof block.text === "string") {
    return block.text;
  }

  return "";
}

function getContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content.map(getTextBlockText).join("");
}

function getMessageText(message: RpcMessageLike): string {
  return getContentText(message.content);
}

function toSnapshotRole(role: string): AgentMessageSnapshot["role"] | null {
  if (role === "assistant" || role === "system" || role === "user") {
    return role;
  }

  if (role === "toolResult") {
    return "tool";
  }

  return null;
}

export function toSnapshotMessages(
  messages: RpcMessageLike[],
): AgentMessageSnapshot[] {
  return messages.flatMap((message) => {
    const role = toSnapshotRole(message.role);

    if (!role) {
      return [];
    }

    return [
      {
        id: `${role}-${message.timestamp}`,
        role,
        text: getMessageText(message),
        status: "complete",
        timestamp: message.timestamp,
      },
    ];
  });
}

function calculateContextTokens(usage: RpcUsageLike): number {
  return (
    usage.totalTokens ??
    usage.input + usage.output + usage.cacheRead + usage.cacheWrite
  );
}

function getAssistantUsage(message: RpcMessageLike): RpcUsageLike | null {
  if (message.role !== "assistant") {
    return null;
  }

  if (message.stopReason === "aborted" || message.stopReason === "error") {
    return null;
  }

  return isRpcUsage(message.usage) ? message.usage : null;
}

function getLastAssistantUsageInfo(messages: RpcMessageLike[]): {
  index: number;
  usage: RpcUsageLike;
} | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    const usage = getAssistantUsage(message);

    if (usage) {
      return { index, usage };
    }
  }

  return null;
}

function getLastCompactionSummaryIndex(messages: RpcMessageLike[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === "compactionSummary") {
      return index;
    }
  }

  return -1;
}

function getEstimatedContentChars(content: unknown): number {
  if (typeof content === "string") {
    return content.length;
  }

  if (!Array.isArray(content)) {
    return 0;
  }

  let chars = 0;

  for (const block of content) {
    if (!isRecord(block) || typeof block.type !== "string") {
      continue;
    }

    if (block.type === "text" && typeof block.text === "string") {
      chars += block.text.length;
    }

    if (block.type === "image") {
      chars += 4_800;
    }
  }

  return chars;
}

function estimateMessageTokens(message: RpcMessageLike): number {
  let chars = 0;

  switch (message.role) {
    case "user": {
      return Math.ceil(getEstimatedContentChars(message.content) / 4);
    }
    case "assistant": {
      if (!Array.isArray(message.content)) {
        return 0;
      }

      for (const block of message.content) {
        if (!isRecord(block) || typeof block.type !== "string") {
          continue;
        }

        if (block.type === "text" && typeof block.text === "string") {
          chars += block.text.length;
          continue;
        }

        if (block.type === "thinking" && typeof block.thinking === "string") {
          chars += block.thinking.length;
          continue;
        }

        if (block.type === "toolCall" && typeof block.name === "string") {
          const argumentsText = JSON.stringify(block.arguments) ?? "";
          chars += block.name.length + argumentsText.length;
        }
      }

      return Math.ceil(chars / 4);
    }
    case "custom":
    case "toolResult": {
      return Math.ceil(getEstimatedContentChars(message.content) / 4);
    }
    case "bashExecution": {
      const command =
        typeof message.command === "string" ? message.command : "";
      const output = typeof message.output === "string" ? message.output : "";
      return Math.ceil((command.length + output.length) / 4);
    }
    case "branchSummary":
    case "compactionSummary": {
      const summary =
        typeof message.summary === "string" ? message.summary : "";
      return Math.ceil(summary.length / 4);
    }
    default: {
      return 0;
    }
  }
}

export function getContextUsage(
  messages: RpcMessageLike[],
  contextWindow: number | undefined,
): ContextUsageSnapshot | undefined {
  if (typeof contextWindow !== "number" || contextWindow <= 0) {
    return undefined;
  }

  const lastCompactionIndex = getLastCompactionSummaryIndex(messages);
  const lastUsageInfo = getLastAssistantUsageInfo(messages);

  if (lastCompactionIndex !== -1) {
    if (!lastUsageInfo || lastUsageInfo.index < lastCompactionIndex) {
      return {
        tokens: null,
        contextWindow,
        percent: null,
      };
    }
  }

  if (!lastUsageInfo) {
    let tokens = 0;

    for (const message of messages) {
      tokens += estimateMessageTokens(message);
    }

    return {
      tokens,
      contextWindow,
      percent: (tokens / contextWindow) * 100,
    };
  }

  let trailingTokens = 0;

  for (
    let index = lastUsageInfo.index + 1;
    index < messages.length;
    index += 1
  ) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    trailingTokens += estimateMessageTokens(message);
  }

  const tokens = calculateContextTokens(lastUsageInfo.usage) + trailingTokens;

  return {
    tokens,
    contextWindow,
    percent: (tokens / contextWindow) * 100,
  };
}

export function mapRpcSettings(state: RpcStateLike | null): SettingsSnapshot {
  return {
    currentProviderId: state?.model?.provider,
    currentModelId: state?.model?.id,
    defaultProvider: state?.model?.provider,
    defaultModel: state?.model?.id,
    thinkingLevel: mapThinkingLevel(state?.thinkingLevel),
  };
}

export function mapRpcProviders(models: unknown[]): ProviderSnapshot[] {
  const providerMap = new Map<string, ModelSnapshot[]>();

  for (const model of models) {
    if (!isRecord(model)) {
      continue;
    }

    const providerId =
      typeof model.provider === "string" ? model.provider : null;
    const modelId = typeof model.id === "string" ? model.id : null;

    if (!providerId || !modelId) {
      continue;
    }

    const providerModels = providerMap.get(providerId) ?? [];
    providerModels.push({
      id: modelId,
      name: typeof model.name === "string" ? model.name : modelId,
      providerId,
      supportsThinking:
        typeof model.reasoning === "boolean" ? model.reasoning : undefined,
      supportsVision: Array.isArray(model.input)
        ? model.input.includes("image")
        : false,
      contextWindow:
        typeof model.contextWindow === "number"
          ? model.contextWindow
          : undefined,
      maxOutputTokens:
        typeof model.maxTokens === "number" ? model.maxTokens : undefined,
    });
    providerMap.set(providerId, providerModels);
  }

  return Array.from(providerMap.entries()).map(
    ([providerId, providerModels]) => ({
      id: providerId,
      name: providerId,
      models: providerModels,
      isConfigured: true,
    }),
  );
}
