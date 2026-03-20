import { describe, expect, it, vi } from "vitest";
import { createAgentHostClient } from "../../../apps/desktop/src/main/agent-host-client";
import type {
  AgentSnapshot,
  PiDeskAgentEvent,
} from "../../../packages/shared/src";

type MessageListener = (message: unknown) => void;

class FakeUtilityProcess {
  public readonly postMessage = vi.fn<(message: unknown) => void>();

  private readonly listeners = new Set<MessageListener>();

  on(event: "message", listener: MessageListener): this {
    if (event === "message") {
      this.listeners.add(listener);
    }

    return this;
  }

  emitMessage(message: unknown): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}

describe("createAgentHostClient", () => {
  it("sends protocol requests and resolves responses", async () => {
    const child = new FakeUtilityProcess();
    const client = createAgentHostClient(child);
    const snapshot: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };

    const bootstrapPromise = client.bootstrap();

    expect(child.postMessage).toHaveBeenNthCalledWith(1, {
      requestId: "1",
      type: "bootstrap",
    });

    child.emitMessage({
      type: "response",
      response: {
        requestId: "1",
        kind: "ack",
      },
    });

    await expect(bootstrapPromise).resolves.toBeUndefined();

    const snapshotPromise = client.getSnapshot();

    expect(child.postMessage).toHaveBeenNthCalledWith(2, {
      requestId: "2",
      type: "getSnapshot",
    });

    child.emitMessage({
      type: "response",
      response: {
        requestId: "2",
        kind: "snapshot",
        snapshot,
      },
    });

    await expect(snapshotPromise).resolves.toEqual(snapshot);

    const promptPromise = client.prompt("Explain the active repository");

    expect(child.postMessage).toHaveBeenNthCalledWith(3, {
      requestId: "3",
      type: "prompt",
      text: "Explain the active repository",
    });

    child.emitMessage({
      type: "response",
      response: {
        requestId: "3",
        kind: "ack",
      },
    });

    await expect(promptPromise).resolves.toBeUndefined();

    const cancelPromise = client.cancelPrompt();

    expect(child.postMessage).toHaveBeenNthCalledWith(4, {
      requestId: "4",
      type: "cancelPrompt",
    });

    child.emitMessage({
      type: "response",
      response: {
        requestId: "4",
        kind: "ack",
      },
    });

    await expect(cancelPromise).resolves.toBeUndefined();
  });

  it("rejects requests when the agent host responds with an error", async () => {
    const child = new FakeUtilityProcess();
    const client = createAgentHostClient(child);

    const bootstrapPromise = client.bootstrap();

    child.emitMessage({
      type: "response",
      response: {
        requestId: "1",
        kind: "error",
        message: "Missing SDK auth",
      },
    });

    await expect(bootstrapPromise).rejects.toThrow("Missing SDK auth");
  });

  it("times out requests that never receive a response", async () => {
    vi.useFakeTimers();

    try {
      const child = new FakeUtilityProcess();
      const client = createAgentHostClient(child, { requestTimeoutMs: 25 });
      const promptPromise = client.prompt("Explain the active repository");
      const timeoutAssertion = expect(promptPromise).rejects.toThrow(
        "Agent host request prompt timed out after 25ms",
      );

      await vi.advanceTimersByTimeAsync(25);

      await timeoutAssertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("forwards agent events to subscribers", () => {
    const child = new FakeUtilityProcess();
    const client = createAgentHostClient(child);
    const listener = vi.fn<(event: PiDeskAgentEvent) => void>();
    const event: PiDeskAgentEvent = {
      type: "message_update",
      messageId: "assistant-1",
      role: "assistant",
      text: "Streaming response",
      delta: "response",
      timestamp: 1,
    };

    const unsubscribe = client.subscribe(listener);

    child.emitMessage({
      type: "event",
      event,
    });

    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();
    child.emitMessage({
      type: "event",
      event: {
        ...event,
        timestamp: 2,
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
