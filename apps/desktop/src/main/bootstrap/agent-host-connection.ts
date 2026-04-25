import {
  type AgentHostClient,
  createAgentHostClient,
} from "../agent-host-client";
import {
  type AgentHostSocketTransport,
  createAgentHostSocketTransport,
} from "../agent-host-socket-transport";

export const SOCKET_CONNECT_TIMEOUT_MS = 5_000;
export const SOCKET_CONNECT_RETRY_MS = 50;

type AgentHostBootstrapClient = Pick<AgentHostClient, "bootstrap">;

type ConnectAgentHostWithRetryBaseOptions = {
  socketPath: string;
  createTransport?: (socketPath: string) => AgentHostSocketTransport;
  delay?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  retryMs?: number;
};

type ConnectAgentHostWithRetryOptions<THost extends AgentHostBootstrapClient> =
  ConnectAgentHostWithRetryBaseOptions & {
    createHost: (transport: AgentHostSocketTransport) => THost;
  };

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function connectAgentHostWithRetry(
  options: ConnectAgentHostWithRetryBaseOptions,
): Promise<{
  host: AgentHostClient;
  transport: AgentHostSocketTransport;
}>;

export function connectAgentHostWithRetry<
  THost extends AgentHostBootstrapClient,
>(
  options: ConnectAgentHostWithRetryOptions<THost>,
): Promise<{
  host: THost;
  transport: AgentHostSocketTransport;
}>;

export async function connectAgentHostWithRetry({
  socketPath,
  createTransport = createAgentHostSocketTransport,
  createHost,
  delay = defaultDelay,
  now = Date.now,
  timeoutMs = SOCKET_CONNECT_TIMEOUT_MS,
  retryMs = SOCKET_CONNECT_RETRY_MS,
}: ConnectAgentHostWithRetryBaseOptions & {
  createHost?: (
    transport: AgentHostSocketTransport,
  ) => AgentHostBootstrapClient;
}): Promise<{
  host: AgentHostBootstrapClient;
  transport: AgentHostSocketTransport;
}> {
  const resolveHost =
    createHost ??
    ((transport: AgentHostSocketTransport) => createAgentHostClient(transport));

  const deadline = now() + timeoutMs;
  let lastError: Error | null = null;

  while (now() < deadline) {
    const transport = createTransport(socketPath);

    try {
      await transport.connect();
      const host = resolveHost(transport);
      await host.bootstrap();
      return { host, transport };
    } catch (error) {
      transport.close();
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error ?? "Unknown socket connect error"));
      await delay(retryMs);
    }
  }

  throw (
    lastError ??
    new Error(`Timed out connecting to agent session socket at ${socketPath}`)
  );
}
