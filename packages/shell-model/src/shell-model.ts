import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  PiDeskAgentEvent,
  PiDeskApi,
  ShellSnapshot,
} from "@pidesk/shared";
import {
  type AgentLiveFeed,
  applyAgentEvent,
  applyLiveAgentEvent,
  createAgentLiveFeedFromSnapshot,
  createInitialAgentLiveFeed,
} from "./agent-feed";

export interface ShellModelState {
  shell: ShellSnapshot;
  agent: AgentSnapshot;
  draft: string;
  live: AgentLiveFeed;
}

interface MessageEnvelopeEvent {
  type: "message_end" | "message_start" | "message_update";
  message: Omit<AgentMessageSnapshot, "timestamp"> & { timestamp?: number };
  delta?: string;
}

const INITIAL_STATE: ShellModelState = {
  shell: {
    appName: "",
    appVersion: "",
    chromeVersion: "unknown",
    platform: "unknown",
    mode: "development",
  },
  agent: {
    sessionId: "",
    status: "starting",
    messages: [],
    lastError: null,
  },
  draft: "",
  live: createInitialAgentLiveFeed(),
};

const MESSAGE_STATUS_PRIORITY = {
  error: 3,
  complete: 2,
  streaming: 1,
} satisfies Record<AgentMessageSnapshot["status"], number>;

function normalizeEvent(
  event: PiDeskAgentEvent | MessageEnvelopeEvent,
): PiDeskAgentEvent {
  if ("message" in event) {
    const timestamp = event.message.timestamp ?? 0;

    if (event.type === "message_update") {
      return {
        type: "message_update",
        messageId: event.message.id,
        role: event.message.role,
        text: event.message.text,
        delta: event.delta,
        timestamp,
      };
    }

    return {
      type: event.type,
      messageId: event.message.id,
      role: event.message.role,
      text: event.message.text,
      timestamp,
    };
  }

  return event;
}

function pickPreferredMessage(
  current: AgentMessageSnapshot,
  incoming: AgentMessageSnapshot,
): AgentMessageSnapshot {
  if (incoming.timestamp > current.timestamp) {
    return incoming;
  }

  if (incoming.timestamp < current.timestamp) {
    return current;
  }

  const currentPriority = MESSAGE_STATUS_PRIORITY[current.status];
  const incomingPriority = MESSAGE_STATUS_PRIORITY[incoming.status];

  if (incomingPriority > currentPriority) {
    return incoming;
  }

  if (incomingPriority < currentPriority) {
    return current;
  }

  return incoming.text.length >= current.text.length ? incoming : current;
}

function determineAgentStatus(
  current: AgentSnapshot,
  incoming: AgentSnapshot,
  preserveLiveState: boolean,
  hasStreamingMessages: boolean,
): AgentSnapshot["status"] {
  // Priority 1: Error status always wins
  if (incoming.status === "error") {
    return incoming.status;
  }

  // Priority 2: Streaming messages take precedence
  if (hasStreamingMessages) {
    return "streaming";
  }

  // Priority 3: Preserve existing live state when requested
  if (preserveLiveState) {
    // When current status is "starting", use incoming status
    // Otherwise preserve the current (live) status
    if (current.status === "starting") {
      return incoming.status;
    }
    return current.status;
  }

  // Default: use incoming status
  return incoming.status;
}

function mergeAgentSnapshots(
  current: AgentSnapshot,
  incoming: AgentSnapshot,
  preserveLiveState: boolean,
): AgentSnapshot {
  const messagesById = new Map<string, AgentMessageSnapshot>();

  for (const message of current.messages) {
    messagesById.set(message.id, message);
  }

  for (const message of incoming.messages) {
    const existing = messagesById.get(message.id);
    messagesById.set(
      message.id,
      existing ? pickPreferredMessage(existing, message) : message,
    );
  }

  const messages = [...messagesById.values()].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
  const hasStreamingMessages = messages.some(
    (message) => message.status === "streaming",
  );
  const status = determineAgentStatus(
    current,
    incoming,
    preserveLiveState,
    hasStreamingMessages,
  );

  return {
    sessionId: incoming.sessionId || current.sessionId,
    status,
    messages,
    lastError:
      incoming.lastError ?? (status === "error" ? current.lastError : null),
  };
}

export function createShellModel(api: PiDeskApi) {
  let state: ShellModelState = INITIAL_STATE;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<(state: ShellModelState) => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState(): ShellModelState {
      return state;
    },

    subscribe(listener: (state: ShellModelState) => void): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    async load(): Promise<void> {
      const [shell, agent] = await Promise.all([
        api.shell.getSnapshot(),
        api.agent.getSnapshot(),
      ]);

      state = {
        ...state,
        shell,
        agent,
        live: {
          ...createAgentLiveFeedFromSnapshot(agent),
          snapshotLoadedAt: Date.now(),
        },
      };
      notify();
      unsubscribe?.();
      unsubscribe = api.agent.subscribe((event) => {
        const normalized = normalizeEvent(event);
        const receivedAt =
          "timestamp" in normalized ? normalized.timestamp : Date.now();

        state = {
          ...state,
          agent: applyAgentEvent(state.agent, normalized),
          live: applyLiveAgentEvent(state.live, normalized, receivedAt),
        };
        notify();
      });
    },

    setDraft(draft: string): void {
      state = { ...state, draft };
      notify();
    },

    async sendPrompt(): Promise<void> {
      const prompt = state.draft.trim();

      if (!prompt) {
        return;
      }

      const eventSequenceAtStart = state.live.lastEventSequence;

      try {
        await api.agent.prompt(prompt);
      } catch {
        // Refresh snapshot below so renderer can surface runtime error state.
      }

      let agent = state.agent;

      try {
        const refreshedSnapshot = await api.agent.getSnapshot();
        const currentState = state;

        agent = mergeAgentSnapshots(
          currentState.agent,
          refreshedSnapshot,
          currentState.live.lastEventSequence > eventSequenceAtStart,
        );
      } catch (error) {
        agent = {
          ...state.agent,
          status: "error",
          lastError:
            error instanceof Error ? error.message : "Unknown agent host error",
        };
      }

      state = {
        ...state,
        agent,
        draft: "",
        live: {
          ...state.live,
          snapshotLoadedAt: Date.now(),
        },
      };
      notify();
    },

    setAgentError(message: string): void {
      state = {
        ...state,
        agent: {
          ...state.agent,
          status: "error",
          lastError: message,
        },
      };
      notify();
    },

    dispose(): void {
      unsubscribe?.();
      unsubscribe = undefined;
      listeners.clear();
    },
  };
}
