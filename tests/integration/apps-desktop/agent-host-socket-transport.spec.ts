import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentHostClient } from "../../../apps/desktop/src/main/agent-host-client";
import { createAgentHostSocketTransport } from "../../../apps/desktop/src/main/agent-host-socket-transport";
import { startAgentHostSocketServer } from "../../../packages/agent-host/src/session-server/socket-bridge";
import type {
  AgentSnapshot,
  PiDesktopAgentEvent,
} from "../../../packages/shared/src";

const tempDirs: string[] = [];

function createSocketPath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pd-st-"));
  tempDirs.push(directory);
  return path.join(directory, "agent-host.sock");
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("createAgentHostSocketTransport", () => {
  it("connects createAgentHostClient to the socket session server protocol", async () => {
    const snapshot: AgentSnapshot = {
      sessionId: "socket-session",
      status: "ready",
      messages: [],
      lastError: null,
    };
    let eventListener: ((event: PiDesktopAgentEvent) => void) | undefined;
    const server = await startAgentHostSocketServer({
      socketPath: createSocketPath(),
      runtime: {
        bootstrap: async () => undefined,
        getProviders: async () => [],
        getSettings: async () => ({}),
        getSnapshot: () => snapshot,
        prompt: async () => undefined,
        reset: async () => undefined,
        subscribe: (listener) => {
          eventListener = listener;
          return () => {
            eventListener = undefined;
          };
        },
      },
    });

    const transport = createAgentHostSocketTransport(server.socketPath);
    await transport.connect();
    const client = createAgentHostClient(transport);
    const received: PiDesktopAgentEvent[] = [];
    client.subscribe((event) => {
      received.push(event);
    });

    await client.bootstrap();
    await expect(client.getSnapshot()).resolves.toEqual(snapshot);

    eventListener?.({ type: "agent_start" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(received).toEqual([{ type: "agent_start" }]);

    transport.close();
    await server.close();
  });

  it("drops malformed frames without crashing and keeps delivering valid ones", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pd-st-"));
    tempDirs.push(directory);
    const socketPath = path.join(directory, "garbage.sock");

    const server = net.createServer((connection) => {
      // Intentionally emit a broken line, then a valid envelope.
      connection.write("{not json\n");
      connection.write(
        `${JSON.stringify({ kind: "event", event: { type: "agent_start" } })}\n`,
      );
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));

    const transport = createAgentHostSocketTransport(socketPath);
    const received: unknown[] = [];
    transport.on("message", (message) => {
      received.push(message);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await transport.connect();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(received).toEqual([
      { kind: "event", event: { type: "agent_start" } },
    ]);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    transport.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("isolates listener failures so a throwing listener does not break peers", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pd-st-"));
    tempDirs.push(directory);
    const socketPath = path.join(directory, "iso.sock");

    const server = net.createServer((connection) => {
      connection.write(
        `${JSON.stringify({ kind: "event", event: { type: "agent_start" } })}\n`,
      );
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));

    const transport = createAgentHostSocketTransport(socketPath);
    const received: unknown[] = [];
    transport.on("message", () => {
      throw new Error("listener boom");
    });
    transport.on("message", (message) => {
      received.push(message);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await transport.connect();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(received).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    transport.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
