import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
});
