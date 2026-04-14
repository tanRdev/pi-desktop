import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type {
  AgentHostEnvelope,
  AgentHostRequest,
  PiDesktopAgentEvent,
} from "@pi-desktop/shared";
import {
  type CommandHandlerRuntime,
  createAgentHostCommandHandler,
} from "../utility-process/command-handler.js";

export interface SocketAgentHostRuntime extends CommandHandlerRuntime {
  subscribe(listener: (event: PiDesktopAgentEvent) => void): () => void;
}

export interface StartAgentHostSocketServerOptions {
  socketPath: string;
  runtime: SocketAgentHostRuntime;
}

export interface AgentHostSocketServer {
  socketPath: string;
  close(): Promise<void>;
}

function writeEnvelope(socket: net.Socket, envelope: AgentHostEnvelope): void {
  socket.write(`${JSON.stringify(envelope)}\n`);
}

export async function startAgentHostSocketServer({
  socketPath,
  runtime,
}: StartAgentHostSocketServerOptions): Promise<AgentHostSocketServer> {
  fs.mkdirSync(path.dirname(socketPath), { recursive: true });
  if (fs.existsSync(socketPath)) {
    fs.rmSync(socketPath, { force: true });
  }

  const sockets = new Set<net.Socket>();
  const handleCommand = createAgentHostCommandHandler(runtime);
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding("utf8");
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk;
      const messages = buffer.split("\n");
      buffer = messages.pop() ?? "";

      for (const message of messages) {
        if (!message.trim()) {
          continue;
        }

        let request: AgentHostRequest | null = null;
        try {
          request = JSON.parse(message) as AgentHostRequest;
        } catch {
          continue;
        }

        void handleCommand(request)
          .then((envelope) => {
            writeEnvelope(socket, envelope);
          })
          .catch((error) => {
            writeEnvelope(socket, {
              type: "response",
              response: {
                requestId: request?.requestId ?? "unknown",
                kind: "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Unknown agent host error",
              },
            });
          });
      }
    });

    const cleanup = () => {
      sockets.delete(socket);
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });

  const unsubscribe = runtime.subscribe((event) => {
    for (const socket of sockets) {
      writeEnvelope(socket, {
        type: "event",
        event,
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (error) => reject(error));
    server.listen(socketPath, () => resolve());
  });

  return {
    socketPath,
    async close() {
      unsubscribe();
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      if (fs.existsSync(socketPath)) {
        fs.rmSync(socketPath, { force: true });
      }
    },
  };
}
