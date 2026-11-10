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
} from "../host/command-handler.js";

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

// Inbound frames are bounded and validated before they reach the command
// handler: a peer that never sends a newline must not grow host memory
// without limit, and malformed payloads get an explicit error response
// instead of being cast to AgentHostRequest and crashing a runtime method.
export const MAX_SOCKET_FRAME_CHARS = 16 * 1024 * 1024;

const AGENT_HOST_REQUEST_TYPES = new Set([
  "bootstrap",
  "reset",
  "getSnapshot",
  "getProviders",
  "getSettings",
  "prompt",
  "cancelPrompt",
  "switchModel",
]);

type ParsedSocketRequest =
  | { ok: true; request: AgentHostRequest }
  | { ok: false; requestId: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseAgentHostSocketRequest(
  message: string,
): ParsedSocketRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(message) as unknown;
  } catch {
    return {
      ok: false,
      requestId: "unknown",
      message: "Malformed agent host request: invalid JSON",
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      requestId: "unknown",
      message: "Malformed agent host request: expected an object",
    };
  }

  const requestId =
    typeof parsed.requestId === "string" && parsed.requestId.length > 0
      ? parsed.requestId
      : "unknown";

  if (requestId === "unknown") {
    return {
      ok: false,
      requestId,
      message: "Malformed agent host request: missing requestId",
    };
  }

  if (
    typeof parsed.type !== "string" ||
    !AGENT_HOST_REQUEST_TYPES.has(parsed.type)
  ) {
    return {
      ok: false,
      requestId,
      message: `Malformed agent host request: unknown type ${String(parsed.type)}`,
    };
  }

  if (parsed.type === "prompt" && typeof parsed.text !== "string") {
    return {
      ok: false,
      requestId,
      message: "Malformed agent host request: prompt text must be a string",
    };
  }

  if (parsed.type === "switchModel") {
    const request = parsed.request;
    if (
      !isRecord(request) ||
      typeof request.providerId !== "string" ||
      typeof request.modelId !== "string"
    ) {
      return {
        ok: false,
        requestId,
        message:
          "Malformed agent host request: switchModel requires providerId and modelId strings",
      };
    }
  }

  return { ok: true, request: parsed as AgentHostRequest };
}

function writeEnvelope(socket: net.Socket, envelope: AgentHostEnvelope): void {
  if (socket.destroyed) {
    return;
  }
  socket.write(`${JSON.stringify(envelope)}\n`);
}

function writeError(
  socket: net.Socket,
  requestId: string,
  message: string,
): void {
  writeEnvelope(socket, {
    type: "response",
    response: { requestId, kind: "error", message },
  });
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
    // Partial frames accumulate as chunks (joined only once a newline
    // arrives) so a large frame costs linear, not quadratic, copying.
    let bufferedChunks: string[] = [];
    let bufferedLength = 0;

    socket.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString();
      bufferedChunks.push(text);
      bufferedLength += text.length;

      if (bufferedLength > MAX_SOCKET_FRAME_CHARS) {
        // No complete frame can be recovered from an over-limit buffer;
        // report it and drop the connection so memory stays bounded.
        bufferedChunks = [];
        bufferedLength = 0;
        const envelope: AgentHostEnvelope = {
          type: "response",
          response: {
            requestId: "unknown",
            kind: "error",
            message:
              "Agent host socket frame exceeded the maximum allowed size",
          },
        };
        socket.write(`${JSON.stringify(envelope)}\n`, () => {
          socket.destroy();
        });
        return;
      }

      if (!text.includes("\n")) {
        return;
      }

      const buffer = bufferedChunks.join("");
      bufferedChunks = [];
      bufferedLength = 0;
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

        const parsed = parseAgentHostSocketRequest(message);

        if (!parsed.ok) {
          writeError(socket, parsed.requestId, parsed.message);
          continue;
        }

        const request = parsed.request;

        void handleCommand(request)
          .then((envelope) => {
            writeEnvelope(socket, envelope);
          })
          .catch((error) => {
            writeError(
              socket,
              request.requestId,
              error instanceof Error
                ? error.message
                : "Unknown agent host error",
            );
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
