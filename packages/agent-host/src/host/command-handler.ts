import type {
  AgentHostEnvelope,
  AgentHostRequest,
  AgentSnapshot,
  ModelSwitchRequest,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";

export interface CommandHandlerRuntime {
  bootstrap(): Promise<void>;
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): AgentSnapshot;
  switchModel(request: ModelSwitchRequest): Promise<void>;
  prompt(text: string): Promise<void>;
  cancelPrompt(): Promise<void>;
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
        case "getProviders":
          return {
            type: "response",
            response: {
              requestId: request.requestId,
              kind: "providers",
              providers: await runtime.getProviders(),
            },
          };
        case "getSettings":
          return {
            type: "response",
            response: {
              requestId: request.requestId,
              kind: "settings",
              settings: await runtime.getSettings(),
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
        case "switchModel":
          await runtime.switchModel(request.request);
          return {
            type: "response",
            response: {
              requestId: request.requestId,
              kind: "ack",
            },
          };
        case "cancelPrompt":
          await runtime.cancelPrompt();
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
          // Runtime invariant: AgentHostRequest is a closed discriminated
          // union and all members are handled above. Reaching this branch
          // means a caller sent a malformed envelope.
          const _exhaustive: never = request;
          void _exhaustive;
          const malformed: { type?: unknown; requestId?: unknown } = request;
          const type =
            typeof malformed.type === "string" ? malformed.type : "<unknown>";
          const requestId =
            typeof malformed.requestId === "string" ? malformed.requestId : "";
          return {
            type: "response",
            response: {
              requestId,
              kind: "error",
              message: `Unknown request type: ${type}`,
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
