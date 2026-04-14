import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { PiCliRpcAgentRuntime } from "../../../packages/agent-host/src/pi/pi-cli-rpc-agent-runtime";
import type { PiDeskAgentEvent } from "../../../packages/shared/src";

type FakeRpcCommand = {
  id?: string;
  type: string;
  [key: string]: unknown;
};

class JsonlWritable extends Writable {
  private buffer = "";

  constructor(private readonly onLine: (line: string) => void) {
    super();
  }

  _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.buffer += chunk.toString();
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim().length > 0) {
        this.onLine(line);
      }
    }

    callback();
  }
}

class FakeRpcChildProcess extends EventEmitter {
  public readonly stdout = new PassThrough();

  public readonly stderr = new PassThrough();

  public readonly stdin: Writable;

  public readonly commands: FakeRpcCommand[] = [];

  constructor(
    private readonly onCommand: (
      command: FakeRpcCommand,
      child: FakeRpcChildProcess,
    ) => void,
  ) {
    super();
    this.stdin = new JsonlWritable((line) => {
      const command = JSON.parse(line) as FakeRpcCommand;
      this.commands.push(command);
      this.onCommand(command, this);
    });
  }

  emitStdout(payload: unknown): void {
    this.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  kill(): boolean {
    this.emit("close", 0, null);
    return true;
  }
}

describe("PiCliRpcAgentRuntime", () => {
  it("boots into a ready state after starting Pi RPC and reading state", async () => {
    const child = new FakeRpcChildProcess((command, currentChild) => {
      if (command.type === "get_state") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_state",
          success: true,
          data: {
            sessionId: "cli-session",
            sessionFile: "/tmp/pidesk-agent/sessions/cli-session.jsonl",
            thinkingLevel: "high",
            isStreaming: false,
            isCompacting: false,
            steeringMode: "all",
            followUpMode: "all",
            autoCompactionEnabled: true,
            messageCount: 0,
            pendingMessageCount: 0,
          },
        });
        return;
      }

      if (command.type === "get_messages") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_messages",
          success: true,
          data: {
            messages: [],
          },
        });
        return;
      }

      throw new Error(
        `Unexpected RPC command during bootstrap: ${command.type}`,
      );
    });

    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: object) => child,
    );

    const runtime = new PiCliRpcAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-agent",
      spawnProcess,
    });

    await runtime.bootstrap();

    expect(spawnProcess).toHaveBeenCalledWith(
      "pi",
      ["--mode", "rpc", "--continue"],
      expect.objectContaining({
        cwd: "/tmp/pidesk-workspace",
        env: expect.objectContaining({
          PI_CODING_AGENT_DIR: "/tmp/pidesk-agent",
        }),
      }),
    );
    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "cli-session",
      status: "ready",
      messages: [],
      lastError: null,
    });
  });

  it("streams Pi RPC events into the agent snapshot after prompting", async () => {
    const child = new FakeRpcChildProcess((command, currentChild) => {
      if (command.type === "get_state") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_state",
          success: true,
          data: {
            sessionId: "cli-session",
            sessionFile: "/tmp/pidesk-agent/sessions/cli-session.jsonl",
            thinkingLevel: "medium",
            isStreaming: false,
            isCompacting: false,
            steeringMode: "all",
            followUpMode: "all",
            autoCompactionEnabled: true,
            messageCount: 0,
            pendingMessageCount: 0,
            model: {
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
              provider: "google",
              reasoning: true,
              input: ["text", "image"],
              contextWindow: 1_048_576,
              maxTokens: 65_536,
            },
          },
        });
        return;
      }

      if (command.type === "get_messages") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_messages",
          success: true,
          data: {
            messages: [],
          },
        });
        return;
      }

      if (command.type === "prompt") {
        const userTimestamp = 100;
        const assistantTimestamp = 101;
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "prompt",
          success: true,
        });
        currentChild.emitStdout({ type: "agent_start" });
        currentChild.emitStdout({ type: "turn_start" });
        currentChild.emitStdout({
          type: "message_start",
          message: {
            role: "user",
            timestamp: userTimestamp,
            content: [{ type: "text", text: command.message }],
          },
        });
        currentChild.emitStdout({
          type: "message_end",
          message: {
            role: "user",
            timestamp: userTimestamp,
            content: [{ type: "text", text: command.message }],
          },
        });
        currentChild.emitStdout({
          type: "message_start",
          message: {
            role: "assistant",
            timestamp: assistantTimestamp,
            content: [],
          },
        });
        currentChild.emitStdout({
          type: "message_update",
          message: {
            role: "assistant",
            timestamp: assistantTimestamp,
            content: [{ type: "text", text: "cli reply" }],
          },
          assistantMessageEvent: {
            type: "text_delta",
            contentIndex: 0,
            delta: "cli reply",
          },
        });
        currentChild.emitStdout({
          type: "message_end",
          message: {
            role: "assistant",
            timestamp: assistantTimestamp,
            content: [{ type: "text", text: "cli reply" }],
          },
        });
        currentChild.emitStdout({ type: "turn_end" });
        currentChild.emitStdout({ type: "agent_end" });
        return;
      }

      throw new Error(`Unexpected RPC command during prompt: ${command.type}`);
    });

    const runtime = new PiCliRpcAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-agent",
      spawnProcess: vi.fn(() => child),
    });
    const events: PiDeskAgentEvent[] = [];

    runtime.subscribe((event) => {
      events.push(event);
    });

    await runtime.bootstrap();
    await runtime.prompt("hello from pi cli");

    expect(events.some((event) => event.type === "agent_start")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "message_update" &&
          event.role === "assistant" &&
          event.text === "cli reply",
      ),
    ).toBe(true);
    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "cli-session",
      status: "ready",
      currentProviderId: "google",
      currentModelId: "gemini-2.5-flash",
    });
    expect(runtime.getSnapshot().messages).toEqual([
      {
        id: "user-100",
        role: "user",
        text: "hello from pi cli",
        status: "complete",
        timestamp: 100,
      },
      {
        id: "assistant-101",
        role: "assistant",
        text: "cli reply",
        status: "complete",
        timestamp: 101,
      },
    ]);
  });

  it("reads providers and settings from Pi RPC state", async () => {
    const child = new FakeRpcChildProcess((command, currentChild) => {
      if (command.type === "get_state") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_state",
          success: true,
          data: {
            sessionId: "cli-session",
            thinkingLevel: "high",
            isStreaming: false,
            isCompacting: false,
            steeringMode: "all",
            followUpMode: "all",
            autoCompactionEnabled: true,
            messageCount: 0,
            pendingMessageCount: 0,
            model: {
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
              provider: "google",
              reasoning: true,
              input: ["text", "image"],
              contextWindow: 1_048_576,
              maxTokens: 65_536,
            },
          },
        });
        return;
      }

      if (command.type === "get_messages") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_messages",
          success: true,
          data: { messages: [] },
        });
        return;
      }

      if (command.type === "get_available_models") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_available_models",
          success: true,
          data: {
            models: [
              {
                id: "gemini-2.5-flash",
                name: "Gemini 2.5 Flash",
                provider: "google",
                reasoning: true,
                input: ["text", "image"],
                contextWindow: 1_048_576,
                maxTokens: 65_536,
              },
            ],
          },
        });
        return;
      }

      throw new Error(`Unexpected RPC command: ${command.type}`);
    });

    const runtime = new PiCliRpcAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-agent",
      spawnProcess: vi.fn(() => child),
    });

    await runtime.bootstrap();

    await expect(runtime.getSettings()).resolves.toEqual({
      currentProviderId: "google",
      currentModelId: "gemini-2.5-flash",
      defaultProvider: "google",
      defaultModel: "gemini-2.5-flash",
      thinkingLevel: "high",
    });
    await expect(runtime.getProviders()).resolves.toEqual([
      {
        id: "google",
        name: "google",
        isConfigured: true,
        models: [
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            providerId: "google",
            supportsThinking: true,
            supportsVision: true,
            contextWindow: 1_048_576,
            maxOutputTokens: 65_536,
          },
        ],
      },
    ]);
  });

  it("resets to a fresh session and emits session_changed", async () => {
    let sessionId = "cli-session-1";
    const child = new FakeRpcChildProcess((command, currentChild) => {
      if (command.type === "get_state") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_state",
          success: true,
          data: {
            sessionId,
            thinkingLevel: "medium",
            isStreaming: false,
            isCompacting: false,
            steeringMode: "all",
            followUpMode: "all",
            autoCompactionEnabled: true,
            messageCount: 0,
            pendingMessageCount: 0,
          },
        });
        return;
      }

      if (command.type === "get_messages") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_messages",
          success: true,
          data: { messages: [] },
        });
        return;
      }

      if (command.type === "new_session") {
        sessionId = "cli-session-2";
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "new_session",
          success: true,
          data: { cancelled: false },
        });
        return;
      }

      throw new Error(`Unexpected RPC command: ${command.type}`);
    });

    const runtime = new PiCliRpcAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-agent",
      spawnProcess: vi.fn(() => child),
    });
    const listener = vi.fn<(event: PiDeskAgentEvent) => void>();

    runtime.subscribe(listener);
    await runtime.bootstrap();
    await runtime.reset();

    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "cli-session-2",
      status: "ready",
      messages: [],
    });
    expect(listener).toHaveBeenCalledWith({ type: "session_changed" });
  });

  it("switches models through Pi RPC without restarting the session", async () => {
    let currentModel = {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      provider: "google",
      reasoning: true,
      input: ["text"],
      contextWindow: 1_048_576,
      maxTokens: 65_536,
    };

    const child = new FakeRpcChildProcess((command, currentChild) => {
      if (command.type === "get_state") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_state",
          success: true,
          data: {
            sessionId: "cli-session",
            thinkingLevel: "medium",
            isStreaming: false,
            isCompacting: false,
            steeringMode: "all",
            followUpMode: "all",
            autoCompactionEnabled: true,
            messageCount: 0,
            pendingMessageCount: 0,
            model: currentModel,
          },
        });
        return;
      }

      if (command.type === "get_messages") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_messages",
          success: true,
          data: { messages: [] },
        });
        return;
      }

      if (command.type === "set_model") {
        currentModel = {
          id: "claude-sonnet-4-20250514",
          name: "Claude Sonnet 4",
          provider: "anthropic",
          reasoning: true,
          input: ["text"],
          contextWindow: 200_000,
          maxTokens: 64_000,
        };
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "set_model",
          success: true,
          data: currentModel,
        });
        return;
      }

      throw new Error(`Unexpected RPC command: ${command.type}`);
    });

    const runtime = new PiCliRpcAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-agent",
      spawnProcess: vi.fn(() => child),
    });

    await runtime.bootstrap();
    await runtime.switchModel({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
    });

    expect(child.commands.map((command) => command.type)).toEqual([
      "get_state",
      "get_messages",
      "set_model",
      "get_state",
      "get_messages",
    ]);
    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "cli-session",
      status: "ready",
      currentProviderId: "anthropic",
      currentModelId: "claude-sonnet-4-20250514",
    });
  });

  it("aborts prompts and refreshes snapshot state", async () => {
    const child = new FakeRpcChildProcess((command, currentChild) => {
      if (command.type === "get_state") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_state",
          success: true,
          data: {
            sessionId: "cli-session",
            thinkingLevel: "medium",
            isStreaming: false,
            isCompacting: false,
            steeringMode: "all",
            followUpMode: "all",
            autoCompactionEnabled: true,
            messageCount: 0,
            pendingMessageCount: 0,
          },
        });
        return;
      }

      if (command.type === "get_messages") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "get_messages",
          success: true,
          data: { messages: [] },
        });
        return;
      }

      if (command.type === "abort") {
        currentChild.emitStdout({
          id: command.id,
          type: "response",
          command: "abort",
          success: true,
        });
        return;
      }

      throw new Error(`Unexpected RPC command: ${command.type}`);
    });

    const runtime = new PiCliRpcAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-agent",
      spawnProcess: vi.fn(() => child),
    });

    await runtime.bootstrap();
    await runtime.cancelPrompt();

    expect(child.commands.some((command) => command.type === "abort")).toBe(
      true,
    );
    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "cli-session",
      status: "ready",
    });
  });
});
