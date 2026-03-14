import type {
  AgentHostEnvelope,
  AgentHostRequest,
  PiDeskAgentEvent,
} from "@pidesk/shared";

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
    subscribe(listener: (event: PiDeskAgentEvent) => void): () => void;
    reset?(): Promise<void>;
  };
}

export function wireAgentHostParentPort({
  parentPort,
  runtime,
}: WireAgentHostParentPortDependencies): () => void {
  const unsubscribe = runtime.subscribe((event: PiDeskAgentEvent) => {
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
        if (typeof (runtime as any).reset === "function") {
          void Promise.resolve((runtime as any).reset())
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
        } else {
          parentPort.postMessage({
            type: "response",
            response: {
              requestId: request.requestId,
              kind: "error",
              message: "Runtime does not support reset",
            },
          });
        }
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
    }
  });

  return unsubscribe;
}
