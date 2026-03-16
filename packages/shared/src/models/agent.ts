export interface ProviderSnapshot {
  id: string;
  name: string;
  models: Array<{ id: string; name: string }>;
}

export interface SettingsSnapshot {
  defaultProvider?: string;
  defaultModel?: string;
  [key: string]: unknown;
}

export type AgentMessageRole = "assistant" | "system" | "tool" | "user";

export type AgentMessageStatus = "complete" | "error" | "streaming";

export interface AgentMessageSnapshot {
  id: string;
  role: AgentMessageRole;
  text: string;
  status: AgentMessageStatus;
  timestamp: number;
}

export type AgentRuntimeStatus = "error" | "ready" | "starting" | "streaming";

export interface AgentSnapshot {
  sessionId: string;
  status: AgentRuntimeStatus;
  messages: AgentMessageSnapshot[];
  lastError: string | null;
}

export type PiDeskAgentEvent =
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
    };
