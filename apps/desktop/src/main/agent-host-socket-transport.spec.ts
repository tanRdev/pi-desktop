import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAgentHostSocketTransport,
  isSocketFrame,
  MAX_SOCKET_FRAME_CHARS,
} from "./agent-host-socket-transport";

describe("isSocketFrame", () => {
  it("accepts JSON objects, including envelopes and legacy shapes", () => {
    expect(isSocketFrame({ type: "event", event: { type: "agent_end" } })).toBe(
      true,
    );
    expect(
      isSocketFrame({
        type: "response",
        response: { requestId: "1", kind: "ack" },
      }),
    ).toBe(true);
    expect(isSocketFrame({ kind: "event", event: { type: "agent_end" } })).toBe(
      true,
    );
  });

  it("rejects non-objects and arrays", () => {
    expect(isSocketFrame(null)).toBe(false);
    expect(isSocketFrame("response")).toBe(false);
    expect(isSocketFrame(42)).toBe(false);
    expect(isSocketFrame([{ type: "event" }])).toBe(false);
  });
});

describe("createAgentHostSocketTransport", () => {
  let server: net.Server | null = null;
  let serverSocket: net.Socket | null = null;
  let socketDirectory: string | null = null;

  afterEach(async () => {
    serverSocket?.destroy();
    serverSocket = null;
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
    if (socketDirectory) {
      fs.rmSync(socketDirectory, { recursive: true, force: true });
      socketDirectory = null;
    }
    vi.restoreAllMocks();
  });

  async function startServer(onSocket: (socket: net.Socket) => void) {
    socketDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "pd-client-"));
    const socketPath = path.join(socketDirectory, "agent.sock");
    server = net.createServer((socket) => {
      serverSocket = socket;
      onSocket(socket);
    });
    await new Promise<void>((resolve) =>
      server?.listen(socketPath, () => resolve()),
    );
    return socketPath;
  }

  it("delivers object frames and drops malformed or non-object frames", async () => {
    const socketPath = await startServer(() => {});
    const transport = createAgentHostSocketTransport(socketPath);
    const messages: unknown[] = [];
    transport.on("message", (message) => {
      messages.push(message);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await transport.connect();
    serverSocket?.write(
      `${JSON.stringify({
        type: "response",
        response: { requestId: "1", kind: "ack" },
      })}\n`,
    );
    serverSocket?.write("not json\n");
    serverSocket?.write("42\n");
    serverSocket?.write(
      `${JSON.stringify({ type: "event", event: { type: "agent_end" } })}\n`,
    );

    await vi.waitFor(() => {
      expect(messages).toHaveLength(2);
    });
    expect(messages[0]).toEqual({
      type: "response",
      response: { requestId: "1", kind: "ack" },
    });
    expect(messages[1]).toEqual({
      type: "event",
      event: { type: "agent_end" },
    });
    expect(errorSpy).toHaveBeenCalledTimes(2);

    transport.close();
  });

  it("notifies disconnect listeners exactly once when the host socket closes", async () => {
    const socketPath = await startServer(() => {});
    const transport = createAgentHostSocketTransport(socketPath);
    const onDisconnect = vi.fn();
    transport.onDisconnect(onDisconnect);

    await transport.connect();
    serverSocket?.destroy();

    await vi.waitFor(() => {
      expect(onDisconnect).toHaveBeenCalledOnce();
    });
    expect(onDisconnect.mock.calls[0]?.[0]).toBeInstanceOf(Error);

    transport.close();
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  // Moving a >16MiB frame through the socket is CPU-bound under test
  // parallelism, so this case gets a longer timeout than the default.
  it("notifies disconnect and drops the connection when a frame exceeds the size bound", async () => {
    const socketPath = await startServer(() => {});
    const transport = createAgentHostSocketTransport(socketPath);
    const messages: unknown[] = [];
    transport.on("message", (message) => {
      messages.push(message);
    });
    const onDisconnect = vi.fn();
    transport.onDisconnect(onDisconnect);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await transport.connect();
    serverSocket?.write("x".repeat(MAX_SOCKET_FRAME_CHARS + 1));

    await vi.waitFor(
      () => {
        expect(onDisconnect).toHaveBeenCalledOnce();
      },
      { timeout: 20_000, interval: 50 },
    );
    expect(onDisconnect.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(messages).toHaveLength(0);

    transport.close();
  }, 30_000);
});
