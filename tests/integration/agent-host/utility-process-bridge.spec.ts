import { describe, expect, test, vi } from "vitest";
import { wireAgentHostParentPort } from "../../../packages/agent-host/src/utility-process/bridge";
import type {
  AgentHostEnvelope,
  AgentHostRequest,
  AgentSnapshot,
} from "../../../packages/shared/src";

class FakeParentPort {
  private listeners = new Set<(event: { data: AgentHostRequest }) => void>();

  postMessage = vi.fn<(message: AgentHostEnvelope) => void>();

  on(
    event: "message",
    listener: (event: { data: AgentHostRequest }) => void,
  ): void {
    if (event === "message") {
      this.listeners.add(listener);
    }
  }

  emit(request: AgentHostRequest): void {
    for (const listener of this.listeners) {
      listener({ data: request });
    }
  }
}

describe("wireAgentHostParentPort", () => {
  test("reads requests from messageEvent.data and posts command responses", async () => {
    const snapshot: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };
    const parentPort = new FakeParentPort();
    const runtime = {
      bootstrap: vi.fn(async () => {}),
      getProviders: vi.fn(async () => []),
      getSettings: vi.fn(async () => ({})),
      getSnapshot: vi.fn(() => snapshot),
      prompt: vi.fn(async () => {}),
      cancelPrompt: vi.fn(async () => {}),
      reset: vi.fn(async () => {}),
      subscribe: vi.fn(() => () => {}),
    };

    wireAgentHostParentPort({ parentPort, runtime });
    parentPort.emit({ requestId: "1", type: "bootstrap" });
    await Promise.resolve();

    expect(runtime.bootstrap).toHaveBeenCalledOnce();
    expect(parentPort.postMessage).toHaveBeenCalledWith({
      type: "response",
      response: {
        requestId: "1",
        kind: "ack",
      },
    });
  });

  test("posts error responses when runtime bootstrap fails", async () => {
    const parentPort = new FakeParentPort();
    const runtime = {
      bootstrap: vi.fn(async () => {
        throw new Error("Missing SDK auth");
      }),
      getProviders: vi.fn(async () => []),
      getSettings: vi.fn(async () => ({})),
      getSnapshot: vi.fn(() => ({
        sessionId: "sdk-session",
        status: "error" as const,
        messages: [],
        lastError: "Missing SDK auth",
      })),
      prompt: vi.fn(async () => {}),
      cancelPrompt: vi.fn(async () => {}),
      reset: vi.fn(async () => {}),
      subscribe: vi.fn(() => () => {}),
    };

    wireAgentHostParentPort({ parentPort, runtime });
    parentPort.emit({ requestId: "1", type: "bootstrap" });
    await Promise.resolve();
    await Promise.resolve();

    expect(parentPort.postMessage).toHaveBeenCalledWith({
      type: "response",
      response: {
        requestId: "1",
        kind: "error",
        message: "Missing SDK auth",
      },
    });
  });

  test("forwards runtime events back to the parent process", () => {
    const parentPort = new FakeParentPort();
    let listener: ((event: { type: "agent_start" }) => void) | undefined;
    const runtime = {
      bootstrap: vi.fn(async () => {}),
      getProviders: vi.fn(async () => []),
      getSettings: vi.fn(async () => ({})),
      getSnapshot: vi.fn(() => ({
        sessionId: "mock-session",
        status: "ready",
        messages: [],
        lastError: null,
      })),
      prompt: vi.fn(async () => {}),
      cancelPrompt: vi.fn(async () => {}),
      reset: vi.fn(async () => {}),
      subscribe: vi.fn(
        (nextListener: (event: { type: "agent_start" }) => void) => {
          listener = nextListener;
          return () => {
            listener = undefined;
          };
        },
      ),
    };

    wireAgentHostParentPort({ parentPort, runtime });
    listener?.({ type: "agent_start" });

    expect(parentPort.postMessage).toHaveBeenCalledWith({
      type: "event",
      event: {
        type: "agent_start",
      },
    });
  });

  test("forwards cancelPrompt requests to the runtime", async () => {
    const parentPort = new FakeParentPort();
    const runtime = {
      bootstrap: vi.fn(async () => {}),
      getProviders: vi.fn(async () => []),
      getSettings: vi.fn(async () => ({})),
      getSnapshot: vi.fn(() => ({
        sessionId: "mock-session",
        status: "ready" as const,
        messages: [],
        lastError: null,
      })),
      prompt: vi.fn(async () => {}),
      cancelPrompt: vi.fn(async () => {}),
      reset: vi.fn(async () => {}),
      subscribe: vi.fn(() => () => {}),
    };

    wireAgentHostParentPort({ parentPort, runtime });
    parentPort.emit({ requestId: "9", type: "cancelPrompt" });
    await Promise.resolve();

    expect(runtime.cancelPrompt).toHaveBeenCalledOnce();
    expect(parentPort.postMessage).toHaveBeenCalledWith({
      type: "response",
      response: {
        requestId: "9",
        kind: "ack",
      },
    });
  });
});
