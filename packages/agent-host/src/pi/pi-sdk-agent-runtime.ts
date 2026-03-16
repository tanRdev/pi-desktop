import {
  type AgentSession,
  type AgentSessionEvent,
  createAgentSession as createPiAgentSession,
} from "@mariozechner/pi-coding-agent";

import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  PiDeskAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pidesk/shared";

import { normalizeAgentSessionEvent } from "../events/normalize-agent-session-event.js";
import { applyEventToSnapshot } from "../state/state-helpers.js";

type AgentListener = (event: PiDeskAgentEvent) => void;

type CreateAgentSession = typeof createPiAgentSession;

type PiSdkAgentRuntimeOptions = {
  cwd: string;
  agentDir?: string;
  createAgentSession?: CreateAgentSession;
};

type StructuredMessage = {
  role: string;
  timestamp: number;
  content?: Array<{ type?: string; text?: string }>;
};

function isStructuredMessage(value: unknown): value is StructuredMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    "timestamp" in value
  );
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

function getMessageText(message: StructuredMessage): string {
  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .flatMap((item) =>
      item && typeof item.text === "string" ? [item.text] : [],
    )
    .join("");
}

function getMessageId(
  message: StructuredMessage,
  role: AgentMessageSnapshot["role"],
): string {
  return `${role}-${message.timestamp}`;
}

function toSnapshotMessages(messages: unknown[]): AgentMessageSnapshot[] {
  return messages.flatMap((message) => {
    if (!isStructuredMessage(message)) {
      return [];
    }

    const role = toSnapshotRole(message.role);

    if (!role) {
      return [];
    }

    return [
      {
        id: getMessageId(message, role),
        role,
        text: getMessageText(message),
        status: "complete" as const,
        timestamp: message.timestamp,
      },
    ];
  });
}

export class PiSdkAgentRuntime {
  private readonly listeners = new Set<AgentListener>();

  private readonly createAgentSession: CreateAgentSession;

  private readonly cwd: string;

  private readonly agentDir?: string;

  private session: AgentSession | null = null;

  private unsubscribeSession: (() => void) | null = null;

  private snapshot: AgentSnapshot = {
    sessionId: "",
    status: "starting",
    messages: [],
    lastError: null,
  };

  constructor({
    cwd,
    agentDir,
    createAgentSession = createPiAgentSession,
  }: PiSdkAgentRuntimeOptions) {
    this.cwd = cwd;
    this.agentDir = agentDir;
    this.createAgentSession = createAgentSession;
  }

  async bootstrap(): Promise<void> {
    if (this.session) {
      return;
    }

    try {
      const result = await this.createAgentSession({
        cwd: this.cwd,
        agentDir: this.agentDir,
      });

      this.session = result.session;
      this.unsubscribeSession?.();
      this.unsubscribeSession = this.session.subscribe(
        (event: AgentSessionEvent) => {
          const normalized = normalizeAgentSessionEvent(event);

          if (normalized) {
            this.snapshot = applyEventToSnapshot(this.snapshot, normalized);
            this.emit(normalized);
          }
        },
      );

      this.refreshSnapshot("ready");
    } catch (error) {
      this.setErrorState(error, "");
      throw error;
    }
  }

  async reset(): Promise<void> {
    // Dispose existing session if present, then create a fresh session.
    try {
      this.unsubscribeSession?.();
      this.unsubscribeSession = null;
      this.session = null;

      const result = await this.createAgentSession({
        cwd: this.cwd,
        agentDir: this.agentDir,
      });

      this.session = result.session;
      this.unsubscribeSession = this.session.subscribe(
        (event: AgentSessionEvent) => {
          const normalized = normalizeAgentSessionEvent(event);

          if (normalized) {
            this.snapshot = applyEventToSnapshot(this.snapshot, normalized);
            this.emit(normalized);
          }
        },
      );

      this.refreshSnapshot("ready");
      // Notify listeners that a reset happened
      this.emit({ type: "agent_end" });
      this.emit({ type: "agent_start" });
    } catch (error) {
      this.setErrorState(error, "");
      throw error;
    }
  }

  async getProviders(): Promise<ProviderSnapshot[]> {
    return [
      {
        id: "google",
        name: "Google",
        models: [
          { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
        ],
      },
      {
        id: "anthropic",
        name: "Anthropic",
        models: [
          { id: "claude-sonnet-4-5-20251101", name: "Claude Sonnet 4.5" },
          { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
        ],
      },
    ];
  }

  async getSettings(): Promise<SettingsSnapshot> {
    return {
      defaultProvider: "google",
      defaultModel: "gemini-2.5-pro",
    };
  }

  subscribe(listener: AgentListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AgentSnapshot {
    return {
      ...this.snapshot,
      messages: this.snapshot.messages.map((message: AgentMessageSnapshot) => ({
        ...message,
      })),
    };
  }

  async prompt(text: string): Promise<void> {
    await this.bootstrap();

    if (!this.session) {
      throw new Error("PiDesk Pi SDK runtime failed to initialize a session");
    }

    this.snapshot = {
      ...this.snapshot,
      status: "streaming",
      lastError: null,
    };

    try {
      await this.session.prompt(text);
      this.refreshSnapshot("ready");
    } catch (error) {
      this.setErrorState(error, this.session.sessionId);
      throw error;
    }
  }

  private refreshSnapshot(status: AgentSnapshot["status"]): void {
    if (!this.session) {
      return;
    }

    this.snapshot = {
      sessionId: this.session.sessionId,
      status,
      messages: toSnapshotMessages(this.session.messages),
      lastError: null,
    };
  }

  private setErrorState(error: unknown, sessionId: string): void {
    this.snapshot = {
      sessionId,
      status: "error",
      messages: this.snapshot.messages,
      lastError:
        error instanceof Error ? error.message : "Unknown Pi SDK runtime error",
    };
  }

  private emit(event: PiDeskAgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export type { PiSdkAgentRuntimeOptions };
