import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startAgentHostSocketServer } from "../../../packages/agent-host/src/session-server/socket-bridge";
import type {
  AgentHostEnvelope,
  AgentSnapshot,
  PiDesktopAgentEvent,
} from "../../../packages/shared/src";

const tempDirs: string[] = [];

function createSocketPath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pd-srv-"));
  tempDirs.push(directory);
  return path.join(directory, "agent-host.sock");
}

async function connect(socketPath: string) {
  const socket = net.createConnection(socketPath);
  const envelopes: AgentHostEnvelope[] = [];
  let buffer = "";

  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) {
        continue;
      }
      envelopes.push(JSON.parse(part) as AgentHostEnvelope);
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("error", (error) => reject(error));
  });

  return {
    socket,
    envelopes,
    async send(message: unknown) {
      socket.write(`${JSON.stringify(message)}\n`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    },
    close() {
      socket.end();
      socket.destroy();
    },
  };
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("startAgentHostSocketServer", () => {
  it("serves command responses and broadcasts runtime events over a unix socket", async () => {
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

    const client = await connect(server.socketPath);

    await client.send({ requestId: "1", type: "bootstrap" });
    await client.send({ requestId: "2", type: "getSnapshot" });
    eventListener?.({ type: "agent_start" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(client.envelopes).toEqual([
      {
        type: "response",
        response: {
          requestId: "1",
          kind: "ack",
        },
      },
      {
        type: "response",
        response: {
          requestId: "2",
          kind: "snapshot",
          snapshot,
        },
      },
      {
        type: "event",
        event: {
          type: "agent_start",
        },
      },
    ]);

    client.close();
    await server.close();
  });
});
