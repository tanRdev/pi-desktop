import type {
  AgentHostEnvelope,
  AgentHostRequest,
  AgentHostResponse,
  AgentSnapshot,
  PiDeskAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pidesk/shared";

type AgentEventListener = (event: PiDeskAgentEvent) => void;

type DistributiveOmit<T, TKey extends PropertyKey> = T extends unknown
  ? Omit<T, TKey>
  : never;

type AgentHostRequestInput = DistributiveOmit<AgentHostRequest, "requestId">;

export interface AgentHostTransport {
  on(event: "message", listener: (message: unknown) => void): this;
  postMessage(message: AgentHostRequest): void;
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
  prompt(text: string): Promise<void>;
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

  function send<TResponse extends AgentHostResponse>(
    request: AgentHostRequestInput,
  ): Promise<TResponse> {
    requestId += 1;

    const nextRequest: AgentHostRequest = {
      requestId: String(requestId),
      ...request,
    } as AgentHostRequest;

    return new Promise<TResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(nextRequest.requestId);
        reject(
          new Error(
            `Agent host request ${nextRequest.type} timed out after ${requestTimeoutMs}ms`,
          ),
        );
      }, requestTimeoutMs);

      pending.set(nextRequest.requestId, {
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response as TResponse);
        },
      });
      child.postMessage(nextRequest);
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
    async prompt(text) {
      await send({ type: "prompt", text });
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
