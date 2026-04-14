/**
 * Model/provider snapshots for Pi integration.
 */

/**
 * Model snapshot with metadata.
 */
export interface ModelSnapshot {
  /** Model ID (e.g., "gemini-2.5-pro") */
  id: string;
  /** Display name */
  name: string;
  /** Provider ID */
  providerId: string;
  /** Whether this model supports thinking */
  supportsThinking?: boolean;
  /** Whether this model supports vision */
  supportsVision?: boolean;
  /** Context window size */
  contextWindow?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
}

/**
 * Provider snapshot with available models.
 */
export interface ProviderSnapshot {
  /** Provider ID (e.g., "google", "anthropic") */
  id: string;
  /** Display name */
  name: string;
  /** Available models */
  models: ModelSnapshot[];
  /** Whether provider is configured (has auth) */
  isConfigured?: boolean;
}

export interface OAuthProviderSnapshot {
  id: string;
  name: string;
  usesCallbackServer?: boolean;
  isAuthenticated?: boolean;
}

/**
 * Settings snapshot with current selection.
 */
export interface SettingsSnapshot {
  /** Currently selected provider ID */
  currentProviderId?: string;
  /** Currently selected model ID */
  currentModelId?: string;
  /** Default provider ID */
  defaultProvider?: string;
  /** Default model ID */
  defaultModel?: string;
  /** Thinking level setting */
  thinkingLevel?: "none" | "low" | "medium" | "high";
  /** Additional settings */
  [key: string]: unknown;
}

/**
 * Agent message role.
 */
export type AgentMessageRole = "assistant" | "system" | "tool" | "user";

/**
 * Agent message status.
 */
export type AgentMessageStatus = "complete" | "error" | "streaming";

/**
 * Agent message snapshot.
 */
export interface AgentMessageSnapshot {
  id: string;
  role: AgentMessageRole;
  text: string;
  status: AgentMessageStatus;
  timestamp: number;
}

/**
 * Context usage snapshot — how much of the model's context window is consumed.
 */
export interface ContextUsageSnapshot {
  /** Estimated tokens used, or null if unknown (e.g. right after compaction). */
  tokens: number | null;
  /** Model context window size. */
  contextWindow: number;
  /** Usage as a percentage (0–100), or null if tokens is unknown. */
  percent: number | null;
}

/**
 * Agent runtime status.
 */
export type AgentRuntimeStatus = "error" | "ready" | "starting" | "streaming";

/**
 * Agent session snapshot.
 */
export interface AgentSnapshot {
  sessionId: string;
  status: AgentRuntimeStatus;
  messages: AgentMessageSnapshot[];
  lastError: string | null;
  /** Current model ID */
  currentModelId?: string;
  /** Current provider ID */
  currentProviderId?: string;
  /** Context window usage — present when the runtime can report it. */
  contextUsage?: ContextUsageSnapshot;
}

/**
 * Pi agent event types.
 */
export type PiDesktopAgentEvent =
  | {
      type: "session_changed";
    }
  | {
      type: "agent_end";
    }
  | {
      type: "agent_start";
    }
  | {
      type: "turn_end";
    }
  | {
      type: "turn_start";
    }
  | {
      type: "message_end" | "message_start";
      messageId: string;
      role: AgentMessageRole;
      text: string;
      timestamp: number;
    }
  | {
      type: "message_update";
      messageId: string;
      role: AgentMessageRole;
      text: string;
      delta?: string;
      timestamp: number;
    }
  | {
      type: "tool_execution_end";
      toolCallId: string;
      toolName: string;
      result: unknown;
      isError: boolean;
    }
  | {
      type: "tool_execution_start";
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  | {
      type: "tool_execution_update";
      toolCallId: string;
      toolName: string;
      args: unknown;
      partialResult: unknown;
    }
  | {
      type: "model_changed";
      providerId: string;
      modelId: string;
    };

/**
 * Model switch request.
 */
export interface ModelSwitchRequest {
  providerId: string;
  modelId: string;
}

/**
 * Pi discovery result.
 */
export interface PiDiscoveryResult {
  /** Whether Pi is installed */
  isInstalled: boolean;
  /** Pi version */
  version?: string;
  /** Global agent directory */
  globalAgentDir?: string;
  /** Available skills */
  skills: PiSkillInfo[];
  /** Available slash commands */
  commands: PiCommandInfo[];
}

/**
 * Pi skill info.
 */
export interface PiSkillInfo {
  /** Skill name */
  name: string;
  /** Skill description */
  description?: string;
  /** Source location */
  source?: string;
}

/**
 * Pi command info.
 */
export interface PiCommandInfo {
  /** Command name (without /) */
  name: string;
  /** Command description */
  description?: string;
  /** Source location */
  source?: string;
}
