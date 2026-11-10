import type { AgentSnapshot, PromptImageAttachment } from "@pi-desktop/shared";

type SwitchContext = {
  repositoryId: string;
  worktreePath: string;
  thread: { id: string };
};

type AgentHostLike = {
  getProviders(): Promise<unknown>;
  getSettings(): Promise<unknown>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string, images?: PromptImageAttachment[]): Promise<void>;
  steer?(text: string, images?: PromptImageAttachment[]): Promise<void>;
  cancelPrompt(): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: (event: unknown) => void): () => void;
};

/** Block steer on loading/failed hosts when the base host supports it. */
function blockedSteer<THost extends AgentHostLike>(
  baseHost: THost,
  message: string,
): Pick<THost, "steer"> {
  return (
    typeof baseHost.steer === "function"
      ? {
          steer: async () => {
            throw new Error(message);
          },
        }
      : {}
  ) as Pick<THost, "steer">;
}

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
    ...blockedSteer(baseHost, "Selected project is still loading"),
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
    ...blockedSteer(baseHost, message),
    async cancelPrompt() {
      return Promise.resolve();
    },
    subscribe() {
      return () => {};
    },
  };
}
