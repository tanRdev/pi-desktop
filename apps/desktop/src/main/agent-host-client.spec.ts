import type {
  AgentHostEnvelope,
  AgentHostRequest,
  AgentHostResponse,
} from "@pi-desktop/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AgentHostTransport,
  createAgentHostClient,
} from "./agent-host-client";

class FakeTransport implements AgentHostTransport {
  readonly sent: AgentHostRequest[] = [];
  failPostMessage: Error | null = null;

  private messageListener: ((message: unknown) => void) | null = null;
  private disconnectListener: ((error: Error) => void) | null = null;

  on(_event: "message", listener: (message: unknown) => void): this {
    this.messageListener = listener;
    return this;
  }

  onDisconnect(listener: (error: Error) => void): this {
    this.disconnectListener = listener;
    return this;
  }

  postMessage(message: AgentHostRequest): void {
    if (this.failPostMessage) {
      throw this.failPostMessage;
    }
    this.sent.push(message);
  }

  respond(response: AgentHostResponse): void {
    const envelope: AgentHostEnvelope = { type: "response", response };
    this.messageListener?.(envelope);
  }

  disconnect(error: Error): void {
    this.disconnectListener?.(error);
  }
}

describe("createAgentHostClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves requests when matching responses arrive", async () => {
    const transport = new FakeTransport();
    const client = createAgentHostClient(transport);

    const bootstrap = client.bootstrap();
    const request = transport.sent[0];
    expect(request?.type).toBe("bootstrap");
    transport.respond({ requestId: request?.requestId ?? "", kind: "ack" });

    await expect(bootstrap).resolves.toBeUndefined();
  });

  it("times out non-prompt requests after the request timeout", async () => {
    vi.useFakeTimers();
    const transport = new FakeTransport();
    const client = createAgentHostClient(transport, {
      requestTimeoutMs: 5_000,
    });

    const snapshot = client.getSnapshot();
    const assertion = expect(snapshot).rejects.toThrow(
      "Agent host request getSnapshot timed out after 5000ms",
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it("does not time out a prompt: long turns stay running past the request timeout", async () => {
    vi.useFakeTimers();
    const transport = new FakeTransport();
    const client = createAgentHostClient(transport, {
      requestTimeoutMs: 5_000,
    });

    let settled = false;
    const prompt = client.prompt("write a long report").then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    // Far beyond the generic request timeout the prompt must still be
    // pending: only the host's acceptance ack (or a disconnect) settles it.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);

    const request = transport.sent[0];
    transport.respond({ requestId: request?.requestId ?? "", kind: "ack" });
    await prompt;
    expect(settled).toBe(true);
  });

  it("rejects every pending request immediately on disconnect, including prompts", async () => {
    const transport = new FakeTransport();
    const client = createAgentHostClient(transport);

    const prompt = client.prompt("hello");
    const snapshot = client.getSnapshot();
    const promptAssertion = expect(prompt).rejects.toThrow(
      "Agent host socket disconnected",
    );
    const snapshotAssertion = expect(snapshot).rejects.toThrow(
      "Agent host socket disconnected",
    );

    transport.disconnect(new Error("Agent host socket disconnected"));

    await promptAssertion;
    await snapshotAssertion;

    // Responses arriving after the disconnect are ignored, not delivered.
    transport.respond({ requestId: "1", kind: "ack" });
  });

  it("rejects and forgets a request when postMessage throws", async () => {
    const transport = new FakeTransport();
    transport.failPostMessage = new Error("transport is not connected");
    const client = createAgentHostClient(transport);

    await expect(client.bootstrap()).rejects.toThrow(
      "transport is not connected",
    );

    // The failed request must not linger as pending: a late response for
    // its id is ignored instead of settling a forgotten promise.
    transport.failPostMessage = null;
    const second = client.bootstrap();
    transport.respond({
      requestId: transport.sent[0]?.requestId ?? "",
      kind: "ack",
    });
    await expect(second).resolves.toBeUndefined();
  });

  it("works with transports that do not expose a disconnect signal", async () => {
    const listeners: Array<(message: unknown) => void> = [];
    const transport: AgentHostTransport = {
      on(_event, listener) {
        listeners.push(listener);
        return this;
      },
      postMessage: vi.fn(),
    };
    const client = createAgentHostClient(transport);

    const bootstrap = client.bootstrap();
    for (const listener of listeners) {
      listener({
        type: "response",
        response: { requestId: "1", kind: "ack" },
      });
    }

    await expect(bootstrap).resolves.toBeUndefined();
  });
});
