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

export type SessionCapabilityServiceOps = {
  getContext(): SwitchContext | null;
  getHost(): AgentHostLike;
  getTransport(): { close(...args: never[]): unknown } | null;
  getUnsubscribe(): () => void;
  commitAttachment(attached: {
    context: SwitchContext;
    host: AgentHostLike;
    transport: { close(...args: never[]): unknown };
  }): void;
  replaceHost(
    host: AgentHostLike,
    options?: {
      context?: SwitchContext | null;
      transport?: { close(...args: never[]): unknown } | null;
      subscribe?: () => () => void;
      closePreviousTransport?: boolean;
    },
  ): void;
  clearSession(host: AgentHostLike): void;
  switchContext(resolveContext: () => Promise<SwitchContext>): Promise<void>;
  dispose(): void;
};

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
