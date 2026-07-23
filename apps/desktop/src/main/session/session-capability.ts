import type { AgentSnapshot } from "@pi-desktop/shared";
import { Context, Effect, Layer } from "effect";

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
};

function createSessionSnapshot(
  context: SwitchContext,
  status: AgentSnapshot["status"],
  lastError: string | null,
): AgentSnapshot {
  return {
    sessionId: context.thread.id,
    status,
    messages: [],
    lastError,
  };
}

export function createLoadingAgentHost<THost extends AgentHostLike>(
  baseHost: THost,
  context: SwitchContext,
): THost {
  return {
    ...baseHost,
    async getProviders() {
      return [];
    },
    async getSettings() {
      return {};
    },
    async getSnapshot() {
      return createSessionSnapshot(context, "starting", null);
    },
    async prompt() {
      throw new Error("Selected project is still loading");
    },
    async cancelPrompt() {
      return Promise.resolve();
    },
    subscribe() {
      return () => {};
    },
  };
}

export function createFailedAgentHost<THost extends AgentHostLike>(
  baseHost: THost,
  context: SwitchContext,
  message: string,
): THost {
  return {
    ...baseHost,
    async getProviders() {
      return [];
    },
    async getSettings() {
      return {};
    },
    async getSnapshot() {
      return createSessionSnapshot(context, "error", message);
    },
    async prompt() {
      throw new Error(message);
    },
    async cancelPrompt() {
      return Promise.resolve();
    },
    subscribe() {
      return () => {};
    },
  };
}

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
    options.notifySessionChanged();

    try {
      const attached = await options.attachContext(nextContext);
      if (switchVersion !== currentVersion) {
        attached.transport.close();
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
      options.notifySessionChanged();
    } catch (error) {
      if (switchVersion !== currentVersion) {
        return;
      }

      previousTransport?.close();
      transport = null;
      host = createFailedAgentHost(
        host,
        nextContext,
        error instanceof Error ? error.message : "Failed to switch session",
      );
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

// ---------------------------------------------------------------------------
// Effect.Service surface (concrete desktop host types are provided at boot)
// ---------------------------------------------------------------------------

export type SessionCapabilityServiceOps = SessionCapabilityOps<
  AgentHostLike,
  { close(...args: never[]): unknown },
  SwitchContext
>;

export class SessionCapabilityService extends Effect.Service<SessionCapabilityService>()(
  "SessionCapabilityService",
  {
    succeed: {
      getContext: () => null,
      getHost: () => {
        throw new Error("SessionCapabilityService stub: getHost");
      },
      getTransport: () => null,
      getUnsubscribe: () => () => {},
      commitAttachment: () => {
        throw new Error("SessionCapabilityService stub: commitAttachment");
      },
      replaceHost: () => {
        throw new Error("SessionCapabilityService stub: replaceHost");
      },
      clearSession: () => {
        throw new Error("SessionCapabilityService stub: clearSession");
      },
      switchContext: async () => {
        throw new Error("SessionCapabilityService stub: switchContext");
      },
      dispose: () => {},
    } satisfies SessionCapabilityServiceOps,
  },
) {}

export const SessionCapability =
  Context.GenericTag<SessionCapabilityServiceOps>(
    "@pi-desktop/SessionCapability",
  );

export const SessionCapabilityLive = (
  capability: SessionCapabilityServiceOps,
): Layer.Layer<SessionCapabilityServiceOps, never, never> =>
  Layer.succeed(SessionCapability, capability);

export const getSessionContext = Effect.gen(function* () {
  const session = yield* SessionCapability;
  return session.getContext();
});

export const getSessionHost = Effect.gen(function* () {
  const session = yield* SessionCapability;
  return session.getHost();
});
