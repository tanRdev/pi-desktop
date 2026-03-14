import type {
  AgentHostEnvelope,
  AgentHostRequest,
  AgentSnapshot,
} from "@pidesk/shared";

export interface CommandHandlerRuntime {
  bootstrap(): Promise<void>;
  getSnapshot(): AgentSnapshot;
  prompt(text: string): Promise<void>;
  // Reset the runtime to a fresh session. Implementations should clear
  // any message history and produce a new session id where applicable.
  reset(): Promise<void>;
}

export function createAgentHostCommandHandler(runtime: CommandHandlerRuntime) {
  return async function handleCommand(
    request: AgentHostRequest,
  ): Promise<AgentHostEnvelope> {
    try {
      switch (request.type) {
        case "bootstrap":
          await runtime.bootstrap();
          return {
            type: "response",
            response: {
              requestId: request.requestId,
              kind: "ack",
            },
          };
        case "getSnapshot":
          return {
            type: "response",
            response: {
              requestId: request.requestId,
              kind: "snapshot",
              snapshot: runtime.getSnapshot(),
            },
          };
        case "prompt":
          await runtime.prompt(request.text);
          return {
            type: "response",
            response: {
              requestId: request.requestId,
              kind: "ack",
            },
          };
        case "reset":
          await runtime.reset();
          return {
            type: "response",
            response: {
              requestId: request.requestId,
              kind: "ack",
            },
          };
        default: {
          const unknownRequest = request as { type: string; requestId: string };
          const _exhaustiveCheck: never = request;
          return {
            type: "response",
            response: {
              requestId: unknownRequest.requestId,
              kind: "error",
              message: `Unknown request type: ${unknownRequest.type}`,
            },
          };
        }
      }
    } catch (error) {
      return {
        type: "response",
        response: {
          requestId: request.requestId,
          kind: "error",
          message:
            error instanceof Error ? error.message : "Unknown agent host error",
        },
      };
    }
  };
}
