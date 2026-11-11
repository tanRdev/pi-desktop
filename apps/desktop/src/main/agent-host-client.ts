import type {
  AgentHostEnvelope,
  AgentHostRequest,
  AgentHostResponse,
  AgentSnapshot,
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  PromptImageAttachment,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";

type AgentEventListener = (event: PiDesktopAgentEvent) => void;

type DistributiveOmit<T, TKey extends PropertyKey> = T extends unknown
  ? Omit<T, TKey>
  : never;

type AgentHostRequestInput = DistributiveOmit<AgentHostRequest, "requestId">;

export interface AgentHostTransport {
  on(event: "message", listener: (message: unknown) => void): this;
  postMessage(message: AgentHostRequest): void;
  // Optional disconnect signal: transports that can detect a dead host
  // (sockets) report it here so pending requests fail immediately instead
  // of waiting for a timeout that may never be appropriate (prompts).
  onDisconnect?(listener: (error: Error) => void): this;
}

interface PendingRequest<
  TResponse extends AgentHostResponse = AgentHostResponse,
> {
  reject(error: Error): void;
  resolve(response: TResponse): void;
}

interface AgentHostClientOptions {
  requestTimeoutMs?: number;
}

export interface AgentHostClient {
  bootstrap(): Promise<void>;
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  switchModel(request: ModelSwitchRequest): Promise<void>;
  prompt(text: string, images?: PromptImageAttachment[]): Promise<void>;
  steer(text: string, images?: PromptImageAttachment[]): Promise<void>;
  cancelPrompt(): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: AgentEventListener): () => void;
}

export function createAgentHostClient(
  child: AgentHostTransport,
  { requestTimeoutMs = 5_000 }: AgentHostClientOptions = {},
): AgentHostClient {
  let requestId = 0;
  const listeners = new Set<AgentEventListener>();
  const pending = new Map<string, PendingRequest>();

  function rejectAllPending(error: Error): void {
    const requests = Array.from(pending.values());
    pending.clear();
    for (const request of requests) {
      request.reject(error);
    }
  }

  child.on("message", (message) => {
    const envelope = message as AgentHostEnvelope;

    if (envelope.type === "event") {
      for (const listener of listeners) {
        listener(envelope.event);
      }

      return;
    }

    if (envelope.type !== "response") {
      return;
    }

    const request = pending.get(envelope.response.requestId);

    if (!request) {
      return;
    }

    pending.delete(envelope.response.requestId);

    if (envelope.response.kind === "error") {
      request.reject(new Error(envelope.response.message));
      return;
    }

    request.resolve(envelope.response);
  });

  child.onDisconnect?.((error) => {
    rejectAllPending(error);
  });

  function send<TResponse extends AgentHostResponse>(
    request: AgentHostRequestInput,
  ): Promise<TResponse> {
    requestId += 1;

    const nextRequest: AgentHostRequest = {
      requestId: String(requestId),
      ...request,
    } as AgentHostRequest;

    return new Promise<TResponse>((resolve, reject) => {
      // Prompt acceptance is separated from turn completion: the host acks
      // a prompt once the turn is accepted, and completion arrives through
      // events. The generic request timeout must therefore not apply to
      // prompts — a long turn is not a stuck request, and timing one out
      // here would report failure for a prompt the host is still running
      // (and must never be retried blindly, since it may have been
      // accepted). A dead host still fails the prompt immediately via the
      // transport disconnect signal above.
      const timeout =
        nextRequest.type === "prompt"
          ? null
          : setTimeout(() => {
              pending.delete(nextRequest.requestId);
              reject(
                new Error(
                  `Agent host request ${nextRequest.type} timed out after ${requestTimeoutMs}ms`,
                ),
              );
            }, requestTimeoutMs);

      pending.set(nextRequest.requestId, {
        reject: (error) => {
          if (timeout) {
            clearTimeout(timeout);
          }
          reject(error);
        },
        resolve: (response) => {
          if (timeout) {
            clearTimeout(timeout);
          }
          resolve(response as TResponse);
        },
      });

      try {
        child.postMessage(nextRequest);
      } catch (error) {
        pending.delete(nextRequest.requestId);
        if (timeout) {
          clearTimeout(timeout);
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  return {
    async bootstrap() {
      await send({ type: "bootstrap" });
    },
    async getSnapshot() {
      const response = await send<
        Extract<AgentHostResponse, { kind: "snapshot" }>
      >({
        type: "getSnapshot",
      });

      return response.snapshot;
    },
    async getProviders() {
      const response = await send<
        Extract<AgentHostResponse, { kind: "providers" }>
      >({
        type: "getProviders",
      });

      return response.providers;
    },
    async getSettings() {
      const response = await send<
        Extract<AgentHostResponse, { kind: "settings" }>
      >({
        type: "getSettings",
      });

      return response.settings;
    },
    async prompt(text, images) {
      await send({
        type: "prompt",
        text,
        ...(images && images.length > 0 ? { images } : {}),
      });
    },
    async steer(text, images) {
      await send({
        type: "steer",
        text,
        ...(images && images.length > 0 ? { images } : {}),
      });
    },
    async switchModel(request) {
      await send({ type: "switchModel", request });
    },
    async cancelPrompt() {
      await send({ type: "cancelPrompt" });
    },
    async reset() {
      await send({ type: "reset" });
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
