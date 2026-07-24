import type { AgentSnapshot } from "@pi-desktop/shared";
import { createFailedAgentHost, createLoadingAgentHost } from "./session-hosts";

export { createFailedAgentHost, createLoadingAgentHost };

type SwitchContext = {
  repositoryId: string;
  worktreePath: string;
  thread: { id: string };
};

type AgentHostLike = {
  getProviders(): Promise<unknown>;
  getSettings(): Promise<unknown>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  cancelPrompt(): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: (event: unknown) => void): () => void;
};

export type SessionAttachment<
  THost extends AgentHostLike,
  TTransport extends { close(...args: never[]): unknown },
  TContext extends SwitchContext = SwitchContext,
> = {
  context: TContext;
  host: THost;
  transport: TTransport;
};

export type SessionCapabilityOps<
  THost extends AgentHostLike,
  TTransport extends { close(...args: never[]): unknown },
  TContext extends SwitchContext = SwitchContext,
> = {
  getContext(): TContext | null;
  getHost(): THost;
  getTransport(): TTransport | null;
  getUnsubscribe(): () => void;
  commitAttachment(
    attached: SessionAttachment<THost, TTransport, TContext>,
  ): void;
  replaceHost(
    host: THost,
    options?: {
      context?: TContext | null;
      transport?: TTransport | null;
      subscribe?: () => () => void;
      closePreviousTransport?: boolean;
    },
  ): void;
  clearSession(host: THost): void;
  switchContext(resolveContext: () => Promise<TContext>): Promise<void>;
  dispose(): void;
};

export type CreateSessionCapabilityOptions<
  THost extends AgentHostLike,
  TTransport extends { close(...args: never[]): unknown },
  TContext extends SwitchContext = SwitchContext,
> = {
  initialHost: THost;
  attachContext(
    context: TContext,
  ): Promise<SessionAttachment<THost, TTransport, TContext>>;
  subscribeToHost(host: THost, thread: TContext["thread"] | null): () => void;
  notifySessionChanged(): void;
  onContextSwitchPhase?(phase: "started" | "completed" | "cancelled"): void;
};

/**
 * Owns Context switch + current agent host/transport/subscription.
 * Mutable session state stays inside this capability — not in main-entry `let` bags.
 */
export function createSessionCapability<
  THost extends AgentHostLike,
  TTransport extends { close(...args: never[]): unknown },
  TContext extends SwitchContext = SwitchContext,
>(
  options: CreateSessionCapabilityOptions<THost, TTransport, TContext>,
): SessionCapabilityOps<THost, TTransport, TContext> {
  let context: TContext | null = null;
  let host: THost = options.initialHost;
  let transport: TTransport | null = null;
  let unsubscribe: () => void = () => {};
  let switchVersion = 0;

  function getContext(): TContext | null {
    return context;
  }

  function getHost(): THost {
    return host;
  }

  function getTransport(): TTransport | null {
    return transport;
  }

  function getUnsubscribe(): () => void {
    return unsubscribe;
  }

  function commitAttachment(
    attached: SessionAttachment<THost, TTransport, TContext>,
  ): void {
    const previousTransport = transport;
    const previousUnsubscribe = unsubscribe;

    context = attached.context;
    host = attached.host;
    transport = attached.transport;
    unsubscribe = options.subscribeToHost(
      attached.host,
      attached.context.thread,
    );

    previousUnsubscribe();
    previousTransport?.close();
  }

  function replaceHost(
    nextHost: THost,
    replaceOptions: {
      context?: TContext | null;
      transport?: TTransport | null;
      subscribe?: () => () => void;
      closePreviousTransport?: boolean;
    } = {},
  ): void {
    const previousTransport = transport;
    const previousUnsubscribe = unsubscribe;
    const closePrevious = replaceOptions.closePreviousTransport !== false;

    context =
      replaceOptions.context === undefined ? context : replaceOptions.context;
    host = nextHost;
    transport =
      replaceOptions.transport === undefined ? null : replaceOptions.transport;
    unsubscribe = replaceOptions.subscribe
      ? replaceOptions.subscribe()
      : () => {};

    previousUnsubscribe();
    if (closePrevious) {
      previousTransport?.close();
    }
  }

  function clearSession(nextHost: THost): void {
    const previousTransport = transport;

    context = null;
    previousTransport?.close();
    transport = null;
    unsubscribe();
    unsubscribe = () => {};
    host = nextHost;
  }

  async function switchContext(
    resolveContext: () => Promise<TContext>,
  ): Promise<void> {
    const nextContext = await resolveContext();
    const currentVersion = switchVersion + 1;
    switchVersion = currentVersion;
    const previousTransport = transport;

    unsubscribe();
    unsubscribe = () => {};
    context = nextContext;
    host = createLoadingAgentHost(host, nextContext);
    options.onContextSwitchPhase?.("started");
    options.notifySessionChanged();

    try {
      const attached = await options.attachContext(nextContext);
      if (switchVersion !== currentVersion) {
        attached.transport.close();
        options.onContextSwitchPhase?.("cancelled");
        return;
      }

      previousTransport?.close();
      context = attached.context;
      host = attached.host;
      transport = attached.transport;
      unsubscribe = options.subscribeToHost(
        attached.host,
        attached.context.thread,
      );
      options.onContextSwitchPhase?.("completed");
      options.notifySessionChanged();
    } catch (error) {
      if (switchVersion !== currentVersion) {
        options.onContextSwitchPhase?.("cancelled");
        return;
      }

      previousTransport?.close();
      transport = null;
      host = createFailedAgentHost(
        host,
        nextContext,
        error instanceof Error ? error.message : "Failed to switch session",
      );
      options.onContextSwitchPhase?.("completed");
      options.notifySessionChanged();
    }
  }

  function dispose(): void {
    unsubscribe();
    unsubscribe = () => {};
    transport?.close();
    transport = null;
  }

  return {
    getContext,
    getHost,
    getTransport,
    getUnsubscribe,
    commitAttachment,
    replaceHost,
    clearSession,
    switchContext,
    dispose,
  };
}

export {
  getSessionContext,
  getSessionHost,
  SessionCapability,
  SessionCapabilityLive,
  SessionCapabilityService,
  type SessionCapabilityServiceOps,
} from "./session-capability-effect";
