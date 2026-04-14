import type { AgentSnapshot } from "@pi-desktop/shared";

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

type AttachedContext<THost extends AgentHostLike, TTransport> = {
  context: SwitchContext;
  host: THost;
  transport: TTransport;
};

export type ContextSwitchState<
  THost extends AgentHostLike,
  TTransport extends { close(...args: never[]): unknown },
> = {
  context: SwitchContext | null;
  host: THost;
  transport: TTransport | null;
  unsubscribe: () => void;
};

type CreateContextSwitchControllerOptions<
  THost extends AgentHostLike,
  TTransport extends { close(...args: never[]): unknown },
> = {
  attachContext(
    context: SwitchContext,
  ): Promise<AttachedContext<THost, TTransport>>;
  subscribeToHost(host: THost, thread: SwitchContext["thread"]): () => void;
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
      return createSessionSnapshot(context, "ready", null);
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

export function createContextSwitchController<
  THost extends AgentHostLike,
  TTransport extends { close(...args: never[]): unknown },
>(
  state: ContextSwitchState<THost, TTransport>,
  options: CreateContextSwitchControllerOptions<THost, TTransport>,
) {
  let switchVersion = 0;

  return {
    async switchContext(
      resolveContext: () => Promise<SwitchContext>,
    ): Promise<void> {
      const nextContext = await resolveContext();
      const currentVersion = switchVersion + 1;
      switchVersion = currentVersion;
      const previousTransport = state.transport;

      state.unsubscribe();
      state.unsubscribe = () => {};
      state.context = nextContext;
      state.host = createLoadingAgentHost(state.host, nextContext);
      options.notifySessionChanged();

      try {
        const attached = await options.attachContext(nextContext);
        if (switchVersion !== currentVersion) {
          attached.transport.close();
          return;
        }

        previousTransport?.close();
        state.context = attached.context;
        state.host = attached.host;
        state.transport = attached.transport;
        state.unsubscribe = options.subscribeToHost(
          attached.host,
          attached.context.thread,
        );
        options.notifySessionChanged();
      } catch (error) {
        if (switchVersion !== currentVersion) {
          return;
        }

        previousTransport?.close();
        state.transport = null;
        state.host = createFailedAgentHost(
          state.host,
          nextContext,
          error instanceof Error ? error.message : "Failed to switch session",
        );
        options.notifySessionChanged();
      }
    },
  };
}
