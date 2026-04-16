import net from "node:net";
import type { AgentHostEnvelope, AgentHostRequest } from "@pi-desktop/shared";
import type { AgentHostTransport } from "./agent-host-client";

type MessageListener = (message: unknown) => void;

export interface AgentHostSocketTransport extends AgentHostTransport {
  connect(): Promise<void>;
  close(): void;
}

export function createAgentHostSocketTransport(
  socketPath: string,
): AgentHostSocketTransport {
  const listeners = new Set<MessageListener>();
  let socket: net.Socket | null = null;
  let buffer = "";

  function attachSocket(nextSocket: net.Socket): void {
    nextSocket.setEncoding("utf8");
    nextSocket.on("data", (chunk) => {
      buffer += chunk;
      const messages = buffer.split("\n");
      buffer = messages.pop() ?? "";

      for (const message of messages) {
        if (!message.trim()) {
          continue;
        }

        let envelope: AgentHostEnvelope;
        try {
          envelope = JSON.parse(message) as AgentHostEnvelope;
        } catch (error) {
          // A malformed frame must not crash the main process. Surface it for
          // diagnostics and keep draining the socket.
          console.error(
            "[agent-host-socket] dropping malformed frame",
            error instanceof Error ? error.message : error,
          );
          continue;
        }

        for (const listener of listeners) {
          try {
            listener(envelope);
          } catch (error) {
            console.error(
              "[agent-host-socket] listener threw",
              error instanceof Error ? (error.stack ?? error.message) : error,
            );
          }
        }
      }
    });
  }

  return {
    on(event: "message", listener: MessageListener) {
      if (event === "message") {
        listeners.add(listener);
      }
      return this;
    },
    postMessage(message: AgentHostRequest) {
      if (!socket || socket.readyState !== "open") {
        throw new Error("Agent host socket transport is not connected");
      }
      socket.write(`${JSON.stringify(message)}\n`);
    },
    async connect() {
      if (socket?.readyState === "open") {
        return;
      }

      socket = net.createConnection(socketPath);
      attachSocket(socket);

      await new Promise<void>((resolve, reject) => {
        socket?.once("connect", () => resolve());
        socket?.once("error", (error) => reject(error));
      });
    },
    close() {
      socket?.end();
      socket?.destroy();
      socket = null;
      buffer = "";
      listeners.clear();
    },
  };
}
