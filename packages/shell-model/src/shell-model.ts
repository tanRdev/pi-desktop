import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  FollowUpQueueState,
  PiDesktopAgentEvent,
  PiDesktopApi,
  PromptImageAttachment,
  ShellSnapshot,
} from "@pi-desktop/shared";
import {
  type AgentLiveFeed,
  applyAgentEvent,
  applyLiveAgentEvent,
  createAgentLiveFeedFromSnapshot,
  createInitialAgentLiveFeed,
} from "./agent-feed";

import { mergeAgentSnapshots } from "./agent-snapshot-merge";
import { createEmptyFollowUpQueue } from "./follow-up-queue";
import type { FollowUpQueueStorage } from "./follow-up-queue-persistence";
import { createFollowUpController } from "./shell-model-follow-ups";

export interface ShellModelState {
  shell: ShellSnapshot;
  agent: AgentSnapshot;
  draft: string;
  live: AgentLiveFeed;
  /** Latest-wins Context switch feedback from SessionCapability. */
  contextSwitchPhase: "idle" | "switching" | "cancelled";
  /** Per-thread follow-up queues, keyed by thread id (issue #10). */
  followUpQueues: Record<string, FollowUpQueueState>;
}

export interface ShellModelOptions {
  /** Persistence adapter for follow-up queues (renderer: localStorage). */
  followUpStorage?: FollowUpQueueStorage;
  /** Id generator for new follow-up items (injectable for tests). */
  createFollowUpId?: () => string;
  /** Clock for follow-up timestamps (injectable for tests). */
  now?: () => number;
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
    catalog: {
      repositories: [],
      selection: {
        repositoryId: null,
        worktreeId: null,
        threadId: null,
      },
    },
  },
  agent: {
    sessionId: "",
    status: "starting",
    messages: [],
    lastError: null,
  },
  draft: "",
  live: createInitialAgentLiveFeed(),
  contextSwitchPhase: "idle",
  followUpQueues: {},
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function normalizeEvent(
  event: PiDesktopAgentEvent | MessageEnvelopeEvent,
): PiDesktopAgentEvent {
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

export function createShellModel(
  api: PiDesktopApi,
  options: ShellModelOptions = {},
) {
  const now = options.now ?? (() => Date.now());
  let followUpIdCounter = 0;
  const createFollowUpId =
    options.createFollowUpId ??
    (() => {
      followUpIdCounter += 1;
      return `follow-up-${now()}-${followUpIdCounter}`;
    });

  let state: ShellModelState = { ...INITIAL_STATE };
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<(state: ShellModelState) => void>();
  let refreshVersion = 0;
  let draftRevision = 0;
  let contextRevision = 0;

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function applyAgentError(message: string): void {
    state = {
      ...state,
      agent: { ...state.agent, status: "error", lastError: message },
    };
    notify();
  }

  function getFollowUpQueue(threadId: string): FollowUpQueueState {
    return state.followUpQueues[threadId] ?? createEmptyFollowUpQueue(threadId);
  }

  function updateFollowUpQueue(queue: FollowUpQueueState): void {
    state = {
      ...state,
      followUpQueues: { ...state.followUpQueues, [queue.threadId]: queue },
    };
    try {
      options.followUpStorage?.write(state.followUpQueues);
    } catch {
      // Persistence is best-effort; the in-memory queue stays authoritative.
    }
    notify();
  }

  async function refreshAgentAfterDispatch(
    contextRevisionAtDispatch: number,
  ): Promise<void> {
    if (contextRevision !== contextRevisionAtDispatch) {
      return;
    }
    const refreshedSnapshot = await api.agent.getSnapshot();
    if (contextRevision !== contextRevisionAtDispatch) {
      return;
    }
    state = {
      ...state,
      agent: mergeAgentSnapshots(
        state.agent,
        refreshedSnapshot,
        state.live.lastEventSequence > 0,
        null,
      ),
      live: { ...state.live, snapshotLoadedAt: Date.now() },
    };
    notify();
  }

  const followUps = createFollowUpController({
    api,
    storage: options.followUpStorage,
    createFollowUpId,
    now,
    getActiveThreadId: () => state.shell.catalog.selection.threadId,
    getAgentStatus: () => state.agent.status,
    getContextRevision: () => contextRevision,
    getQueue: getFollowUpQueue,
    updateQueue: updateFollowUpQueue,
    refreshAgentAfterDispatch,
    setAgentError: applyAgentError,
  });

  state = { ...state, followUpQueues: followUps.initialQueues };

  async function refreshSnapshots(): Promise<void> {
    const nextVersion = refreshVersion + 1;
    refreshVersion = nextVersion;
    const [shell, agent] = await Promise.all([
      api.shell.getSnapshot(),
      api.agent.getSnapshot(),
    ]);

    if (refreshVersion !== nextVersion) {
      return;
    }

    const contextChanged =
      shell.catalog.selection.threadId !==
      state.shell.catalog.selection.threadId;
    if (contextChanged) {
      contextRevision += 1;
      draftRevision += 1;
    }

    state = {
      ...state,
      shell,
      agent,
      draft: contextChanged ? "" : state.draft,
      live: {
        ...createAgentLiveFeedFromSnapshot(agent),
        snapshotLoadedAt: Date.now(),
      },
    };

    notify();

    // Resume any persisted follow-ups for the now-active idle thread.
    void followUps.dispatchFollowUps();
  }

  function handleAgentEvent(
    event: PiDesktopAgentEvent | MessageEnvelopeEvent,
  ): void {
    const normalized = normalizeEvent(event);

    if (normalized.type === "session_changed") {
      void refreshSnapshots();
      return;
    }

    if (normalized.type === "context_switch") {
      if (normalized.phase === "started") contextRevision += 1;
      state = {
        ...state,
        contextSwitchPhase:
          normalized.phase === "started"
            ? "switching"
            : normalized.phase === "cancelled"
              ? "cancelled"
              : "idle",
      };
      notify();
      return;
    }

    const receivedAt =
      "timestamp" in normalized ? normalized.timestamp : Date.now();

    state = {
      ...state,
      agent: applyAgentEvent(state.agent, normalized),
      live: applyLiveAgentEvent(state.live, normalized, receivedAt),
    };
    notify();

    if (normalized.type === "agent_end") {
      // The current run finished without being cancelled by the queue:
      // dispatch the next follow-up, if any.
      void followUps.dispatchFollowUps();
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
      await refreshSnapshots();
      unsubscribe?.();
      unsubscribe = api.agent.subscribe(handleAgentEvent);
    },

    setDraft(draft: string): void {
      draftRevision += 1;
      state = { ...state, draft };
      notify();
    },

    async sendPrompt(
      text?: string,
      images?: PromptImageAttachment[],
    ): Promise<void> {
      const prompt = text ?? state.draft;

      if (!prompt.trim()) {
        return;
      }

      const draftBeforeSend = state.draft;
      const submittedDraftRevision = draftRevision;
      const submittedContextRevision = contextRevision;

      state = {
        ...state,
        agent: {
          ...state.agent,
          status: "starting",
          lastError: null,
        },
      };
      notify();

      const eventSequenceAtStart = state.live.lastEventSequence;
      let promptError: unknown = null;

      try {
        if (images && images.length > 0) {
          await api.agent.prompt(prompt, [...images]);
        } else {
          await api.agent.prompt(prompt);
        }
      } catch (error) {
        promptError = error;
        // Refreshing the snapshot below gives us the authoritative runtime state.
      }

      if (contextRevision !== submittedContextRevision) return;

      void promptError;

      let agent = state.agent;

      try {
        const refreshedSnapshot = await api.agent.getSnapshot();
        if (contextRevision !== submittedContextRevision) return;
        const currentState = state;

        agent = mergeAgentSnapshots(
          currentState.agent,
          refreshedSnapshot,
          currentState.live.lastEventSequence > eventSequenceAtStart,
          promptError,
        );
        if (
          promptError instanceof Error &&
          refreshedSnapshot.lastError == null
        ) {
          agent = {
            ...agent,
            status: "error",
            lastError: promptError.message,
          };
        }
      } catch (error) {
        agent = {
          ...state.agent,
          status: "error",
          lastError: getErrorMessage(error, "Unknown agent host error"),
        };
      }

      if (contextRevision !== submittedContextRevision) return;
      const failed = promptError != null || agent.status === "error";

      const nextDraft =
        draftRevision === submittedDraftRevision
          ? failed
            ? draftBeforeSend
            : ""
          : state.draft;

      state = {
        ...state,
        agent,
        // Keep the user's draft on failure so they can edit and retry.
        draft: nextDraft,
        live: {
          ...state.live,
          snapshotLoadedAt: Date.now(),
        },
      };
      notify();

      if (!failed) {
        void followUps.dispatchFollowUps();
      }
    },

    // Follow-up queue + steer surface (issue #10), implemented by the
    // follow-up controller in shell-model-follow-ups.ts.
    enqueueFollowUp: followUps.enqueueFollowUp,
    editFollowUp: followUps.editFollowUp,
    deleteFollowUp: followUps.deleteFollowUp,
    moveFollowUp: followUps.moveFollowUp,
    setFollowUpPaused: followUps.setFollowUpPaused,
    retryFollowUp: followUps.retryFollowUp,
    dispatchFollowUps: followUps.dispatchFollowUps,
    steerPrompt: followUps.steerPrompt,

    async cancelPrompt(): Promise<void> {
      let cancelError: unknown = null;

      try {
        await api.agent.cancelPrompt();
      } catch (error) {
        cancelError = error;
      }

      try {
        const refreshedSnapshot = await api.agent.getSnapshot();
        const mergedAgent = mergeAgentSnapshots(
          state.agent,
          refreshedSnapshot,
          false,
          cancelError,
        );

        state = {
          ...state,
          agent: {
            ...mergedAgent,
            status: refreshedSnapshot.status,
          },
          live: {
            ...state.live,
            snapshotLoadedAt: Date.now(),
          },
        };
      } catch (error) {
        state = {
          ...state,
          agent: {
            ...state.agent,
            status: "error",
            lastError: getErrorMessage(
              cancelError ?? error,
              "Unknown agent host error",
            ),
          },
        };
      }

      notify();
    },

    setAgentError(message: string): void {
      applyAgentError(message);
    },

    dispose(): void {
      unsubscribe?.();
      unsubscribe = undefined;
      listeners.clear();
    },
  };
}
