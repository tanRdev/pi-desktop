import type {
  AgentHostEnvelope,
  AgentHostRequest,
  PiDesktopAgentEvent,
} from "@pi-desktop/shared";

import type { CommandHandlerRuntime } from "./command-handler.js";

export interface ParentPortLike {
  on(
    event: "message",
    listener: (event: { data: AgentHostRequest }) => void,
  ): void;
  postMessage(message: AgentHostEnvelope): void;
}

export interface WireAgentHostParentPortDependencies {
  parentPort: ParentPortLike;
  runtime: CommandHandlerRuntime & {
    subscribe(listener: (event: PiDesktopAgentEvent) => void): () => void;
  };
}

export function wireAgentHostParentPort({
  parentPort,
  runtime,
}: WireAgentHostParentPortDependencies): () => void {
  const unsubscribe = runtime.subscribe((event: PiDesktopAgentEvent) => {
    parentPort.postMessage({
      type: "event",
      event,
    });
  });

  parentPort.on("message", (messageEvent: { data: AgentHostRequest }) => {
    const request = messageEvent.data;

    const respondWithError = (error: unknown) => {
      parentPort.postMessage({
        type: "response",
        response: {
          requestId: request.requestId,
          kind: "error",
          message:
            error instanceof Error ? error.message : "Unknown agent host error",
        },
      });
    };

    switch (request.type) {
      case "bootstrap":
        void Promise.resolve(runtime.bootstrap())
          .then(() => {
            parentPort.postMessage({
              type: "response",
              response: {
                requestId: request.requestId,
                kind: "ack",
              },
            });
          })
          .catch(respondWithError);
        return;
      case "reset":
        void Promise.resolve(runtime.reset())
          .then(() => {
            parentPort.postMessage({
              type: "response",
              response: {
                requestId: request.requestId,
                kind: "ack",
              },
            });
          })
          .catch(respondWithError);
        return;
      case "getSnapshot":
        parentPort.postMessage({
          type: "response",
          response: {
            requestId: request.requestId,
            kind: "snapshot",
            snapshot: runtime.getSnapshot(),
          },
        });
        return;
      case "getProviders":
        void Promise.resolve(runtime.getProviders())
          .then((providers) => {
            parentPort.postMessage({
              type: "response",
              response: {
                requestId: request.requestId,
                kind: "providers",
                providers,
              },
            });
          })
          .catch(respondWithError);
        return;
      case "getSettings":
        void Promise.resolve(runtime.getSettings())
          .then((settings) => {
            parentPort.postMessage({
              type: "response",
              response: {
                requestId: request.requestId,
                kind: "settings",
                settings,
              },
            });
          })
          .catch(respondWithError);
        return;
      case "prompt":
        void Promise.resolve(runtime.prompt(request.text))
          .then(() => {
            parentPort.postMessage({
              type: "response",
              response: {
                requestId: request.requestId,
                kind: "ack",
              },
            });
          })
          .catch(respondWithError);
        return;
      case "switchModel":
        void Promise.resolve(runtime.switchModel(request.request))
          .then(() => {
            parentPort.postMessage({
              type: "response",
              response: {
                requestId: request.requestId,
                kind: "ack",
              },
            });
          })
          .catch(respondWithError);
        return;
      case "cancelPrompt":
        void Promise.resolve(runtime.cancelPrompt())
          .then(() => {
            parentPort.postMessage({
              type: "response",
              response: {
                requestId: request.requestId,
                kind: "ack",
              },
            });
          })
          .catch(respondWithError);
        return;
      default: {
        const _exhaustive: never = request;
        void _exhaustive;
        return;
      }
    }
  });

  return unsubscribe;
}
