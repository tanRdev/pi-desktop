import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";

type AgentListener = (event: PiDesktopAgentEvent) => void;

const SESSION_ID = "mock-session";

export class MockAgentRuntime {
  private listeners = new Set<AgentListener>();

  private currentPromptAbort: AbortController | null = null;

  private snapshot: AgentSnapshot = {
    sessionId: SESSION_ID,
    status: "starting",
    messages: [],
    lastError: null,
    currentProviderId: "google",
    currentModelId: "gemini-2.5-pro",
  };

  async reset(): Promise<void> {
    this.currentPromptAbort?.abort();
    this.currentPromptAbort = null;
    this.snapshot = {
      sessionId: `${SESSION_ID}-${Date.now()}`,
      status: "ready",
      messages: [],
      lastError: null,
    };
    // Emit an agent_end -> agent_start cycle so listeners know the session reset
    // occurred and UI can reconcile state without a full reload.
    this.emit({ type: "agent_end" });
    this.emit({ type: "agent_start" });
  }

  async getProviders(): Promise<ProviderSnapshot[]> {
    return [
      {
        id: "google",
        name: "Google",
        models: [
          {
            id: "gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
            providerId: "google",
          },
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            providerId: "google",
          },
        ],
      },
      {
        id: "anthropic",
        name: "Anthropic",
        models: [
          {
            id: "claude-sonnet-4-5-20251101",
            name: "Claude Sonnet 4.5",
            providerId: "anthropic",
          },
          {
            id: "claude-3-7-sonnet-20250219",
            name: "Claude 3.7 Sonnet",
            providerId: "anthropic",
          },
        ],
      },
    ];
  }

  async getSettings(): Promise<SettingsSnapshot> {
    return {
      currentProviderId: this.snapshot.currentProviderId,
      currentModelId: this.snapshot.currentModelId,
      defaultProvider: this.snapshot.currentProviderId,
      defaultModel: this.snapshot.currentModelId,
    };
  }

  async switchModel(request: ModelSwitchRequest): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      currentProviderId: request.providerId,
      currentModelId: request.modelId,
    };
    this.emit({
      type: "model_changed",
      providerId: request.providerId,
      modelId: request.modelId,
    });
  }

  async bootstrap(): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      sessionId: SESSION_ID,
      status: "ready",
      lastError: null,
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
    if (this.snapshot.status === "starting") {
      await this.bootstrap();
    }

    const timestamp = Date.now();
    const userMessage: AgentMessageSnapshot = {
      id: `user-${timestamp}`,
      role: "user",
      text,
      status: "complete",
      timestamp,
    };

    const assistantTimestamp = timestamp + 1;
    const assistantText = `Pi Desktop mock assistant received: ${text}`;
    const assistantMessage: AgentMessageSnapshot = {
      id: `assistant-${assistantTimestamp}`,
      role: "assistant",
      text: assistantText,
      status: "streaming",
      timestamp: assistantTimestamp,
    };

    const abortController = new AbortController();
    this.currentPromptAbort = abortController;

    const stopIfAborted = () => {
      if (!abortController.signal.aborted) {
        return false;
      }

      this.snapshot = {
        ...this.snapshot,
        status: "ready",
      };
      this.emit({ type: "turn_end" });
      this.emit({ type: "agent_end" });
      if (this.currentPromptAbort === abortController) {
        this.currentPromptAbort = null;
      }
      return true;
    };

    this.snapshot = {
      ...this.snapshot,
      status: "streaming",
      messages: [...this.snapshot.messages, userMessage, assistantMessage],
    };

    this.emit({ type: "agent_start" });
    this.emit({ type: "turn_start" });

    await Promise.resolve();
    if (stopIfAborted()) {
      return;
    }

    this.emit({
      type: "tool_execution_start",
      toolCallId: `tool-inspect-${timestamp}`,
      toolName: "workspace.inspect",
      args: { prompt: text },
    });
    this.emit({
      type: "tool_execution_update",
      toolCallId: `tool-inspect-${timestamp}`,
      toolName: "workspace.inspect",
      args: { prompt: text },
      partialResult: { status: "collecting-context" },
    });
    this.emit({
      type: "tool_execution_end",
      toolCallId: `tool-inspect-${timestamp}`,
      toolName: "workspace.inspect",
      result: { status: "ok" },
      isError: false,
    });

    await Promise.resolve();
    if (stopIfAborted()) {
      return;
    }

    this.emit({
      type: "message_start",
      messageId: assistantMessage.id,
      role: assistantMessage.role,
      text: "",
      timestamp: assistantMessage.timestamp,
    });
    this.emit({
      type: "message_update",
      messageId: assistantMessage.id,
      role: assistantMessage.role,
      text: assistantText,
      delta: assistantText,
      timestamp: assistantMessage.timestamp,
    });
    this.emit({
      type: "tool_execution_start",
      toolCallId: `tool-compose-${timestamp}`,
      toolName: "reply.compose",
      args: { prompt: text, response: assistantText },
    });
    this.emit({
      type: "tool_execution_update",
      toolCallId: `tool-compose-${timestamp}`,
      toolName: "reply.compose",
      args: { prompt: text, response: assistantText },
      partialResult: { status: "drafting" },
    });

    await Promise.resolve();
    if (stopIfAborted()) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      status: "ready",
      messages: this.snapshot.messages.map((message: AgentMessageSnapshot) =>
        message.id === assistantMessage.id
          ? {
              ...message,
              status: "complete",
            }
          : message,
      ),
    };

    this.emit({
      type: "message_end",
      messageId: assistantMessage.id,
      role: assistantMessage.role,
      text: assistantText,
      timestamp: assistantMessage.timestamp,
    });
    this.emit({
      type: "tool_execution_end",
      toolCallId: `tool-compose-${timestamp}`,
      toolName: "reply.compose",
      result: { messageId: assistantMessage.id },
      isError: false,
    });
    this.emit({ type: "turn_end" });
    this.emit({ type: "agent_end" });
    if (this.currentPromptAbort === abortController) {
      this.currentPromptAbort = null;
    }
  }

  async cancelPrompt(): Promise<void> {
    this.currentPromptAbort?.abort();
    this.currentPromptAbort = null;
  }

  private emit(event: PiDesktopAgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
