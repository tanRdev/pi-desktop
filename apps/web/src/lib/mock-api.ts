import type {
  AgentSnapshot,
  PiDeskAgentEvent,
  PiDeskApi,
  ShellSnapshot,
} from "@pidesk/shared";

// Mock agent responses for demo purposes
const MOCK_RESPONSES: string[] = [
  "I can help you with that! Let me analyze your request and provide a comprehensive solution.",
  "Here's what I found: The issue appears to be related to configuration. Try checking your settings.",
  "I'll help you refactor this code. First, let's identify the key patterns...",
  "Great question! There are several approaches to solve this:",
];

const MOCK_TOOL_CALLS = [
  { name: "read_file", args: { path: "src/config.ts" } },
  { name: "search_code", args: { query: "function handleRequest" } },
  { name: "edit_file", args: { path: "src/utils.ts", changes: "refactor" } },
];

class MockAgentRuntime {
  private listeners: Set<(event: PiDeskAgentEvent) => void> = new Set();
  private sessionId: string;
  private messageCounter = 0;
  private isStreaming = false;

  constructor() {
    this.sessionId = `web-session-${Date.now()}`;
  }

  subscribe(listener: (event: PiDeskAgentEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: PiDeskAgentEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async prompt(userText: string): Promise<void> {
    if (this.isStreaming) return;
    this.isStreaming = true;

    const messageId = `msg-${++this.messageCounter}`;
    const turnId = `turn-${Date.now()}`;

    // Emit agent_start
    this.emit({ type: "agent_start", timestamp: Date.now() });

    // Emit turn_start
    this.emit({ type: "turn_start", turnId, timestamp: Date.now() });

    // Simulate user message
    this.emit({
      type: "message_start",
      messageId: `user-${messageId}`,
      role: "user",
      text: userText,
      timestamp: Date.now(),
    });

    this.emit({
      type: "message_end",
      messageId: `user-${messageId}`,
      role: "user",
      text: userText,
      timestamp: Date.now(),
    });

    // Small delay before assistant response
    await delay(300);

    // Simulate tool execution
    const toolCallId = `tool-${Date.now()}`;
    const toolCall = MOCK_TOOL_CALLS[Math.floor(Math.random() * MOCK_TOOL_CALLS.length)];

    if (Math.random() > 0.5) {
      this.emit({
        type: "tool_execution_start",
        toolCallId,
        toolName: toolCall.name,
        args: toolCall.args,
        timestamp: Date.now(),
      });

      await delay(800);

      this.emit({
        type: "tool_execution_end",
        toolCallId,
        toolName: toolCall.name,
        result: { success: true, data: "mock result" },
        isError: false,
        timestamp: Date.now(),
      });

      await delay(200);
    }

    // Simulate assistant streaming response
    const responseText = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
    const words = responseText.split(" ");

    this.emit({
      type: "message_start",
      messageId,
      role: "assistant",
      text: "",
      timestamp: Date.now(),
    });

    let currentText = "";
    for (let i = 0; i < words.length; i++) {
      await delay(50 + Math.random() * 100);
      currentText += (i > 0 ? " " : "") + words[i];
      this.emit({
        type: "message_update",
        messageId,
        role: "assistant",
        text: currentText,
        delta: words[i] + " ",
        timestamp: Date.now(),
      });
    }

    this.emit({
      type: "message_end",
      messageId,
      role: "assistant",
      text: currentText,
      timestamp: Date.now(),
    });

    // Emit turn_end
    this.emit({ type: "turn_end", turnId, timestamp: Date.now() });

    // Emit agent_end
    this.emit({ type: "agent_end", timestamp: Date.now() });

    this.isStreaming = false;
  }

  async reset(): Promise<void> {
    this.sessionId = `web-session-${Date.now()}`;
    this.messageCounter = 0;
    this.isStreaming = false;
  }

  getSnapshot(): AgentSnapshot {
    return {
      sessionId: this.sessionId,
      status: this.isStreaming ? "streaming" : "ready",
      messages: [],
      lastError: null,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Create singleton runtime
const mockRuntime = new MockAgentRuntime();

// Create the mock API
export function createMockPiDeskApi(): PiDeskApi {
  return {
    shell: {
      getSnapshot(): Promise<ShellSnapshot> {
        return Promise.resolve({
          appName: "PiDesk Web",
          appVersion: "0.1.0",
          chromeVersion: navigator.userAgent.includes("Chrome")
            ? navigator.userAgent.match(/Chrome\/(\d+\.\d+)/)?.[1] || "unknown"
            : "unknown",
          platform: navigator.platform,
          mode: "development",
        });
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
