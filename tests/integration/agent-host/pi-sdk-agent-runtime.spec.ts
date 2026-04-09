import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

import { PiSdkAgentRuntime } from "../../../packages/agent-host/src/pi/pi-sdk-agent-runtime";
import type { PiDeskAgentEvent } from "../../../packages/shared/src";

type FakeSession = {
  sessionId: string;
  messages: unknown[];
  subscribe: (listener: (event: AgentSessionEvent) => void) => () => void;
  prompt: (text: string) => Promise<void>;
};

function createFakeSession(): FakeSession {
  const listeners = new Set<(event: AgentSessionEvent) => void>();

  const session: FakeSession = {
    sessionId: "sdk-session",
    messages: [],
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    async prompt(text: string) {
      const timestamp = 123;
      const assistantTimestamp = timestamp + 1;
      const assistantText = `PiDesk SDK assistant received: ${text}`;

      session.messages = [
        {
          role: "user",
          timestamp,
          content: [{ type: "text", text }],
        },
        {
          role: "assistant",
          timestamp: assistantTimestamp,
          content: [{ type: "text", text: assistantText }],
        },
      ];

      const assistantMessage = {
        role: "assistant",
        timestamp: assistantTimestamp,
        content: [{ type: "text", text: assistantText }],
      };

      for (const listener of listeners) {
        listener({ type: "agent_start" } as AgentSessionEvent);
        listener({ type: "turn_start" } as AgentSessionEvent);
        listener({
          type: "message_start",
          message: assistantMessage,
        } as AgentSessionEvent);
        listener({
          type: "message_update",
          message: assistantMessage,
          assistantMessageEvent: {
            type: "text_delta",
            contentIndex: 0,
            delta: assistantText,
            partial: {
              role: "assistant",
              api: "mock-api",
              provider: "mock-provider",
              model: "mock-model",
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0,
              },
              stopReason: "stop",
              timestamp: assistantTimestamp,
              content: [{ type: "text", text: assistantText }],
            },
          },
        } as AgentSessionEvent);
        listener({
          type: "message_end",
          message: assistantMessage,
        } as AgentSessionEvent);
        listener({ type: "turn_end" } as AgentSessionEvent);
        listener({ type: "agent_end" } as AgentSessionEvent);
      }
    },
  };

  return session;
}

describe("PiSdkAgentRuntime", () => {
  it("boots into a ready state after creating an SDK session", async () => {
    const session = createFakeSession();
    const createAgentSession = vi.fn().mockResolvedValue({
      session,
      extensionsResult: {
        loadedExtensions: [],
        errors: [],
      },
    });

    const runtime = new PiSdkAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-agent",
      createAgentSession,
    });

    await runtime.bootstrap();

    expect(createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/tmp/pidesk-workspace",
        agentDir: "/tmp/pidesk-agent",
      }),
    );
    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "sdk-session",
      status: "ready",
      lastError: null,
    });
  });

  it("normalizes Pi session events and refreshes the snapshot after prompting", async () => {
    const session = createFakeSession();
    const events: PiDeskAgentEvent[] = [];
    const runtime = new PiSdkAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      createAgentSession: vi.fn().mockResolvedValue({
        session,
        extensionsResult: {
          loadedExtensions: [],
          errors: [],
        },
      }),
    });

    runtime.subscribe((event) => {
      events.push(event);
    });

    await runtime.bootstrap();
    await runtime.prompt("hello from pi sdk");

    expect(events.some((event) => event.type === "agent_start")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "message_update" &&
          event.role === "assistant" &&
          event.text.includes("hello from pi sdk"),
      ),
    ).toBe(true);

    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "sdk-session",
      status: "ready",
    });
    expect(runtime.getSnapshot().messages).toEqual([
      {
        id: "user-123",
        role: "user",
        text: "hello from pi sdk",
        status: "complete",
        timestamp: 123,
      },
      {
        id: "assistant-124",
        role: "assistant",
        text: "PiDesk SDK assistant received: hello from pi sdk",
        status: "complete",
        timestamp: 124,
      },
    ]);
  });

  it("keeps displayable custom Pi messages in snapshots", async () => {
    const customTimestamp = 200;
    const session: FakeSession = {
      sessionId: "sdk-session",
      messages: [
        {
          role: "custom",
          customType: "plan-mode-execute",
          content: "Execute the plan.",
          display: true,
          timestamp: customTimestamp,
        },
      ],
      subscribe() {
        return () => undefined;
      },
      async prompt() {
        return undefined;
      },
    };
    const runtime = new PiSdkAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      createAgentSession: vi.fn().mockResolvedValue({
        session,
        extensionsResult: {
          loadedExtensions: [],
          errors: [],
        },
      }),
    });

    await runtime.bootstrap();

    expect(runtime.getSnapshot().messages).toContainEqual({
      id: "custom-plan-mode-execute-200",
      role: "system",
      text: "Execute the plan.",
      status: "complete",
      timestamp: 200,
    });
  });

  it("marks the snapshot as errored when sdk bootstrap fails", async () => {
    const runtime = new PiSdkAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      createAgentSession: vi.fn(async () => {
        throw new Error("Missing SDK auth");
      }),
    });

    await expect(runtime.bootstrap()).rejects.toThrow("Missing SDK auth");
    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "",
      status: "error",
      lastError: "Missing SDK auth",
    });
  });

  it("marks the snapshot as errored when prompting fails", async () => {
    const listeners = new Set<(event: AgentSessionEvent) => void>();
    const session: FakeSession = {
      sessionId: "sdk-session",
      messages: [],
      subscribe(listener) {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
      async prompt() {
        throw new Error("Provider request failed");
      },
    };
    const runtime = new PiSdkAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      createAgentSession: vi.fn().mockResolvedValue({
        session,
        extensionsResult: {
          loadedExtensions: [],
          errors: [],
        },
      }),
    });

    await runtime.bootstrap();
    await expect(runtime.prompt("hello from pi sdk")).rejects.toThrow(
      "Provider request failed",
    );

    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "sdk-session",
      status: "error",
      lastError: "Provider request failed",
    });
  });

  it("preserves partial streamed messages when prompting fails mid-stream", async () => {
    const listeners = new Set<(event: AgentSessionEvent) => void>();
    const assistantTimestamp = 124;
    const partialText = "Partial answer from Pi SDK";
    const assistantMessage = {
      role: "assistant",
      timestamp: assistantTimestamp,
      content: [{ type: "text", text: partialText }],
    };
    const session: FakeSession = {
      sessionId: "sdk-session",
      messages: [],
      subscribe(listener) {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
      async prompt() {
        for (const listener of listeners) {
          listener({ type: "agent_start" } as AgentSessionEvent);
          listener({ type: "turn_start" } as AgentSessionEvent);
          listener({
            type: "message_start",
            message: assistantMessage,
          } as AgentSessionEvent);
          listener({
            type: "message_update",
            message: assistantMessage,
            assistantMessageEvent: {
              type: "text_delta",
              contentIndex: 0,
              delta: partialText,
              partial: {
                role: "assistant",
                api: "mock-api",
                provider: "mock-provider",
                model: "mock-model",
                usage: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                  total: 0,
                },
                stopReason: "stop",
                timestamp: assistantTimestamp,
                content: [{ type: "text", text: partialText }],
              },
            },
          } as AgentSessionEvent);
        }

        throw new Error("Provider stream interrupted");
      },
    };
    const runtime = new PiSdkAgentRuntime({
      cwd: "/tmp/pidesk-workspace",
      createAgentSession: vi.fn().mockResolvedValue({
        session,
        extensionsResult: {
          loadedExtensions: [],
          errors: [],
        },
      }),
    });

    await runtime.bootstrap();
    await expect(runtime.prompt("hello from pi sdk")).rejects.toThrow(
      "Provider stream interrupted",
    );

    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "sdk-session",
      status: "error",
      lastError: "Provider stream interrupted",
    });
    expect(runtime.getSnapshot().messages).toContainEqual({
      id: "assistant-124",
      role: "assistant",
      text: "Partial answer from Pi SDK",
      status: "streaming",
      timestamp: 124,
    });
  });
});
