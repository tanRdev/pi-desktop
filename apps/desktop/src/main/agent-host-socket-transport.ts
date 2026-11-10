import net from "node:net";
import type { AgentHostEnvelope, AgentHostRequest } from "@pi-desktop/shared";
import type { AgentHostTransport } from "./agent-host-client";

type MessageListener = (message: unknown) => void;
type DisconnectListener = (error: Error) => void;

export interface AgentHostSocketTransport extends AgentHostTransport {
  connect(): Promise<void>;
  close(): void;
  // The socket transport always reports disconnects (unlike generic
  // transports, where the signal is optional).
  onDisconnect(listener: (error: Error) => void): this;
}

// Inbound frames are bounded: a host that never sends a newline must not
// grow main-process memory without limit. Oversized partial frames are
// dropped and the connection is torn down, which also fails any pending
// client requests through the disconnect signal.
export const MAX_SOCKET_FRAME_CHARS = 16 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// The transport validates frame shape only as far as it safely can: a
// frame must be a JSON object. Strict protocol validation lives at the
// ends of the pipe — the host's socket bridge validates requests before
// dispatch, and the client discriminates envelopes by `type` before
// acting on them — so unknown or legacy fields are forwarded untouched
// rather than silently desynchronizing the stream.
export function isSocketFrame(value: unknown): value is AgentHostEnvelope {
  return isRecord(value) && !Array.isArray(value);
}

export function createAgentHostSocketTransport(
  socketPath: string,
): AgentHostSocketTransport {
  const listeners = new Set<MessageListener>();
  const disconnectListeners = new Set<DisconnectListener>();
  let socket: net.Socket | null = null;
  // Partial frames accumulate as chunks (joined only once a newline
  // arrives) so a large frame costs linear, not quadratic, copying.
  let bufferedChunks: string[] = [];
  let bufferedLength = 0;
  let disconnectNotified = false;

  function resetBuffer(): void {
    bufferedChunks = [];
    bufferedLength = 0;
  }

  function notifyDisconnect(error: Error): void {
    if (disconnectNotified) {
      return;
    }
    disconnectNotified = true;

    for (const listener of disconnectListeners) {
      try {
        listener(error);
      } catch (listenerError) {
        console.error(
          "[agent-host-socket] disconnect listener threw",
          listenerError instanceof Error
            ? (listenerError.stack ?? listenerError.message)
            : listenerError,
        );
      }
    }
  }

  function attachSocket(nextSocket: net.Socket): void {
    nextSocket.setEncoding("utf8");
    nextSocket.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString();
      bufferedChunks.push(text);
      bufferedLength += text.length;

      if (bufferedLength > MAX_SOCKET_FRAME_CHARS) {
        console.error(
          "[agent-host-socket] dropping connection: frame exceeded maximum size",
        );
        resetBuffer();
        notifyDisconnect(
          new Error(
            "Agent host socket frame exceeded the maximum allowed size",
          ),
        );
        nextSocket.destroy();
        return;
      }

      if (!text.includes("\n")) {
        return;
      }

      const buffer = bufferedChunks.join("");
      resetBuffer();
      const messages = buffer.split("\n");
      const remainder = messages.pop() ?? "";
      if (remainder) {
        bufferedChunks = [remainder];
        bufferedLength = remainder.length;
      }

      for (const message of messages) {
        if (!message.trim()) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(message) as unknown;
        } catch (error) {
          // A malformed frame must not crash the main process. Surface it for
          // diagnostics and keep draining the socket.
          console.error(
            "[agent-host-socket] dropping malformed frame",
            error instanceof Error ? error.message : error,
          );
          continue;
        }

        if (!isSocketFrame(parsed)) {
          console.error(
            "[agent-host-socket] dropping frame that is not a JSON object",
          );
          continue;
        }

        for (const listener of listeners) {
          try {
            listener(parsed);
          } catch (error) {
            console.error(
              "[agent-host-socket] listener threw",
              error instanceof Error ? (error.stack ?? error.message) : error,
            );
          }
        }
      }
    });

    nextSocket.on("error", (error) => {
      notifyDisconnect(
        new Error(`Agent host socket disconnected: ${error.message}`),
      );
    });
    nextSocket.on("close", () => {
      notifyDisconnect(new Error("Agent host socket disconnected"));
    });
  }

  return {
    on(event: "message", listener: MessageListener) {
      if (event === "message") {
        listeners.add(listener);
      }
      return this;
    },
    onDisconnect(listener: DisconnectListener) {
      disconnectListeners.add(listener);
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

      disconnectNotified = false;
      socket = net.createConnection(socketPath);
      attachSocket(socket);

      await new Promise<void>((resolve, reject) => {
        socket?.once("connect", () => resolve());
        socket?.once("error", (error) => reject(error));
      });
    },
    close() {
      // An intentional close still ends every pending request: nothing
      // will ever answer them on this transport.
      notifyDisconnect(new Error("Agent host socket transport closed"));
      socket?.end();
      socket?.destroy();
      socket = null;
      resetBuffer();
      listeners.clear();
    },
  };
}
