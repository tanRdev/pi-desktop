/**
 * @deprecated Prefer `createSessionCapability` from `./session/session-capability`.
 * Kept as a thin adapter so existing integration tests keep passing during Spine 3.
 */
import {
  createFailedAgentHost,
  createLoadingAgentHost,
  createSessionCapability,
  type SessionAttachment,
  type SessionCapabilityOps,
} from "./session/session-capability";

export { createFailedAgentHost, createLoadingAgentHost };

type SwitchContext = {
  repositoryId: string;
  worktreePath: string;
  thread: { id: string };
};

type AgentHostLike = {
  getProviders(): Promise<unknown>;
  getSettings(): Promise<unknown>;
  getSnapshot(): Promise<import("@pi-desktop/shared").AgentSnapshot>;
  prompt(text: string): Promise<void>;
  cancelPrompt(): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: (event: unknown) => void): () => void;
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
  ): Promise<SessionAttachment<THost, TTransport, SwitchContext>>;
  subscribeToHost(host: THost, thread: SwitchContext["thread"]): () => void;
  notifySessionChanged(): void;
};

export function createContextSwitchController<
  THost extends AgentHostLike,
  TTransport extends { close(...args: never[]): unknown },
>(
  state: ContextSwitchState<THost, TTransport>,
  options: CreateContextSwitchControllerOptions<THost, TTransport>,
) {
  const session: SessionCapabilityOps<THost, TTransport, SwitchContext> =
    createSessionCapability({
      initialHost: state.host,
      attachContext: options.attachContext,
      subscribeToHost: (host, thread) =>
        thread ? options.subscribeToHost(host, thread) : () => {},
      notifySessionChanged: () => {
        syncStateFromSession();
        options.notifySessionChanged();
      },
    });

  // Seed capability from the mutable bag used by legacy callers/tests.
  if (state.context || state.transport) {
    session.replaceHost(state.host, {
      context: state.context,
      transport: state.transport,
      subscribe: () => state.unsubscribe,
      closePreviousTransport: false,
    });
  }

  function syncStateFromSession(): void {
    state.context = session.getContext();
    state.host = session.getHost();
    state.transport = session.getTransport();
    state.unsubscribe = session.getUnsubscribe();
  }

  syncStateFromSession();

  return {
    async switchContext(
      resolveContext: () => Promise<SwitchContext>,
    ): Promise<void> {
      await session.switchContext(resolveContext);
      syncStateFromSession();
    },
  };
}
