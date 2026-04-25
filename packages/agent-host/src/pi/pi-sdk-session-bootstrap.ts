import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";

import type { AgentSnapshot, PiDesktopAgentEvent } from "@pi-desktop/shared";

import { normalizeAgentSessionEvent } from "../events/normalize-agent-session-event.js";

type SessionBootstrapTarget = {
  subscribe: (listener: (event: AgentSessionEvent) => void) => () => void;
};

type CreateSessionOptions = {
  cwd: string;
  agentDir?: string;
};

type CreateSession<TSession extends SessionBootstrapTarget> = (
  options: CreateSessionOptions,
) => Promise<{ session: TSession }>;

type CreateBootstrappedSessionOptions<TSession extends SessionBootstrapTarget> =
  {
    createSession: CreateSession<TSession>;
    createSessionOptions: CreateSessionOptions;
    snapshot: AgentSnapshot;
    applyNormalizedEvent: (
      snapshot: AgentSnapshot,
      event: PiDesktopAgentEvent,
    ) => AgentSnapshot;
    emit: (event: PiDesktopAgentEvent) => void;
    refreshReadySnapshot: (session: TSession) => AgentSnapshot;
  };

type BootstrappedSession<TSession extends SessionBootstrapTarget> = {
  session: TSession;
  snapshot: AgentSnapshot;
  unsubscribe: () => void;
};

export async function createBootstrappedSession<
  TSession extends SessionBootstrapTarget,
>({
  createSession,
  createSessionOptions,
  snapshot,
  applyNormalizedEvent,
  emit,
  refreshReadySnapshot,
}: CreateBootstrappedSessionOptions<TSession>): Promise<
  BootstrappedSession<TSession>
> {
  const result = await createSession(createSessionOptions);
  const session = result.session;
  let nextSnapshot = snapshot;

  const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
    const normalized = normalizeAgentSessionEvent(event);

    if (!normalized) {
      return;
    }

    nextSnapshot = applyNormalizedEvent(nextSnapshot, normalized);
    emit(normalized);
  });

  nextSnapshot = refreshReadySnapshot(session);

  return {
    session,
    snapshot: nextSnapshot,
    unsubscribe,
  };
}

export type { SessionBootstrapTarget };
