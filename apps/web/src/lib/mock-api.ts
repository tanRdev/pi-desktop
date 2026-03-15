import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  PiDeskAgentEvent,
  PiDeskApi,
  ShellSnapshot,
} from "@pidesk/shared";

type AgentListener = (event: PiDeskAgentEvent) => void;

const SESSION_ID = "web-mock-session";
const WORKSPACE_ROOT = "/Users/tan/Dev/PiDesk";

function detectChromeVersion() {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  if (!navigator.userAgent.includes("Chrome")) {
    return "unknown";
  }

  return navigator.userAgent.match(/Chrome\/(\d+\.\d+)/)?.[1] || "unknown";
}

function createShellSnapshot(): ShellSnapshot {
  return {
    appName: "PiDesk",
    appVersion: "0.1.0",
    chromeVersion: detectChromeVersion(),
    platform: typeof navigator === "undefined" ? "unknown" : navigator.platform,
    mode: "development",
    runtime: {
      agentMode: "mock",
    },
    workspace: {
      rootPath: WORKSPACE_ROOT,
      agentDirectory: `${WORKSPACE_ROOT}/.opencode`,
      projects: [
        {
          id: "pidesk",
          name: "PiDesk",
          path: WORKSPACE_ROOT,
          isActive: true,
        },
      ],
    },
    capabilities: {
      supportsTurns: true,
      supportsTools: true,
      supportsActivity: true,
      supportsParallelSessions: false,
    },
    git: {
      status: "repository",
      rootPath: WORKSPACE_ROOT,
      branch: "main",
      commit: "mock-web",
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: null,
    },
  };
}

class MockAgentRuntime {
  private listeners = new Set<AgentListener>();

  private snapshot: AgentSnapshot = {
    sessionId: SESSION_ID,
    status: "starting",
    messages: [],
    lastError: null,
  };

  async reset(): Promise<void> {
    this.snapshot = {
      sessionId: `${SESSION_ID}-${Date.now()}`,
      status: "ready",
      messages: [],
      lastError: null,
    };
    this.emit({ type: "agent_end" });
    this.emit({ type: "agent_start" });
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
    const assistantText = `PiDesk mock assistant received: ${text}`;
    const assistantMessage: AgentMessageSnapshot = {
      id: `assistant-${assistantTimestamp}`,
      role: "assistant",
      text: assistantText,
      status: "streaming",
      timestamp: assistantTimestamp,
    };

    this.snapshot = {
      ...this.snapshot,
      status: "streaming",
      messages: [...this.snapshot.messages, userMessage, assistantMessage],
    };

    this.emit({ type: "agent_start" });
    this.emit({ type: "turn_start" });
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
  }

  private emit(event: PiDeskAgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

const mockRuntime = new MockAgentRuntime();

export function createMockPiDeskApi(): PiDeskApi {
  return {
    shell: {
      getSnapshot(): Promise<ShellSnapshot> {
        return Promise.resolve(createShellSnapshot());
      },
    },
    agent: {
      getSnapshot(): Promise<AgentSnapshot> {
        return Promise.resolve(mockRuntime.getSnapshot());
      },
      prompt(text: string): Promise<void> {
        return mockRuntime.prompt(text);
      },
      reset(): Promise<void> {
        return mockRuntime.reset();
      },
      subscribe(listener: (event: PiDeskAgentEvent) => void): () => void {
        return mockRuntime.subscribe(listener);
      },
    },
  };
}
