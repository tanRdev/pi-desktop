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
