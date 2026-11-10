import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandHandlerRuntime } from "../host/command-handler.js";
import {
  MAX_SOCKET_FRAME_CHARS,
  parseAgentHostSocketRequest,
  type SocketAgentHostRuntime,
  startAgentHostSocketServer,
} from "./socket-bridge.js";

function makeRuntime(
  overrides: Partial<CommandHandlerRuntime> = {},
): SocketAgentHostRuntime {
  return {
    bootstrap: vi.fn(async () => {}),
    getProviders: vi.fn(async () => []),
    getSettings: vi.fn(async () => ({})),
    getSnapshot: vi.fn(() => ({
      sessionId: "s1",
      status: "ready" as const,
      messages: [],
      lastError: null,
    })),
    switchModel: vi.fn(async () => {}),
    prompt: vi.fn(async () => {}),
    cancelPrompt: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
    subscribe: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe("parseAgentHostSocketRequest", () => {
  it("accepts a well-formed prompt request", () => {
    const parsed = parseAgentHostSocketRequest(
      JSON.stringify({ requestId: "r1", type: "prompt", text: "hello" }),
    );

    expect(parsed).toEqual({
      ok: true,
      request: { requestId: "r1", type: "prompt", text: "hello" },
    });
  });

  it("rejects invalid JSON with an unknown request id", () => {
    expect(parseAgentHostSocketRequest("{nope")).toEqual({
      ok: false,
      requestId: "unknown",
      message: "Malformed agent host request: invalid JSON",
    });
  });

  it("rejects requests without a string requestId", () => {
    const parsed = parseAgentHostSocketRequest(
      JSON.stringify({ type: "bootstrap" }),
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.message).toContain("missing requestId");
    }
  });

  it("rejects unknown request types", () => {
    const parsed = parseAgentHostSocketRequest(
      JSON.stringify({ requestId: "r2", type: "rm -rf" }),
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.requestId).toBe("r2");
      expect(parsed.message).toContain("unknown type");
    }
  });

  it("rejects prompt requests whose text is not a string", () => {
    const parsed = parseAgentHostSocketRequest(
      JSON.stringify({ requestId: "r3", type: "prompt", text: 42 }),
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.message).toContain("prompt text must be a string");
    }
  });

  it("rejects switchModel requests without provider and model ids", () => {
    const parsed = parseAgentHostSocketRequest(
      JSON.stringify({
        requestId: "r4",
        type: "switchModel",
        request: { providerId: "google" },
      }),
    );

    expect(parsed.ok).toBe(false);
  });
});

describe("startAgentHostSocketServer", () => {
  let server: Awaited<ReturnType<typeof startAgentHostSocketServer>> | null =
    null;
  let client: net.Socket | null = null;
  let socketDirectory: string | null = null;

  afterEach(async () => {
    client?.destroy();
    client = null;
    await server?.close().catch(() => undefined);
    server = null;
    if (socketDirectory) {
      fs.rmSync(socketDirectory, { recursive: true, force: true });
      socketDirectory = null;
    }
  });

  async function connectAndCollect(runtime: SocketAgentHostRuntime) {
    socketDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "pd-sock-"));
    const socketPath = path.join(socketDirectory, "agent.sock");
    server = await startAgentHostSocketServer({ socketPath, runtime });

    const received: string[] = [];
    let notify: (() => void) | null = null;
    const waitForLines = (count: number) =>
      new Promise<void>((resolve) => {
        if (received.length >= count) {
          resolve();
          return;
        }
        notify = () => {
          if (received.length >= count) {
            resolve();
          }
        };
      });

    client = net.createConnection(socketPath);
    client.setEncoding("utf8");
    let buffer = "";
    client.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          received.push(line);
        }
      }
      notify?.();
    });
    await new Promise<void>((resolve) =>
      client?.once("connect", () => resolve()),
    );

    return { received, waitForLines };
  }

  it("answers valid requests and rejects malformed frames with an error envelope", async () => {
    const runtime = makeRuntime();
    const { received, waitForLines } = await connectAndCollect(runtime);

    client?.write(`${JSON.stringify({ requestId: "a", type: "bootstrap" })}\n`);
    client?.write(
      `${JSON.stringify({ requestId: "b", type: "prompt", text: 7 })}\n`,
    );
    client?.write("not json\n");

    await waitForLines(3);

    const envelopes = received.map(
      (line) => JSON.parse(line) as Record<string, unknown>,
    );
    expect(envelopes).toContainEqual({
      type: "response",
      response: { requestId: "a", kind: "ack" },
    });
    expect(envelopes).toContainEqual({
      type: "response",
      response: {
        requestId: "b",
        kind: "error",
        message: "Malformed agent host request: prompt text must be a string",
      },
    });
    expect(envelopes).toContainEqual({
      type: "response",
      response: {
        requestId: "unknown",
        kind: "error",
        message: "Malformed agent host request: invalid JSON",
      },
    });
    expect(runtime.prompt).not.toHaveBeenCalled();
    expect(runtime.bootstrap).toHaveBeenCalledOnce();
  });

  // Moving a >16MiB frame through the socket is CPU-bound under test
  // parallelism, so this case gets a longer timeout than the default.
  it("destroys a connection whose unterminated frame exceeds the size bound", async () => {
    const runtime = makeRuntime();
    const { received, waitForLines } = await connectAndCollect(runtime);

    const closed = new Promise<void>((resolve) =>
      client?.once("close", () => resolve()),
    );

    client?.write("x".repeat(MAX_SOCKET_FRAME_CHARS + 1));

    await waitForLines(1);
    await closed;

    const envelope = JSON.parse(received[0] ?? "{}") as Record<string, unknown>;
    expect(envelope).toEqual({
      type: "response",
      response: {
        requestId: "unknown",
        kind: "error",
        message: "Agent host socket frame exceeded the maximum allowed size",
      },
    });
    expect(runtime.bootstrap).not.toHaveBeenCalled();
  }, 30_000);
});
