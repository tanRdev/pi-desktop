import type {
  AgentSnapshot,
  FollowUpQueueState,
  PiDesktopApi,
  PromptImageAttachment,
} from "@pi-desktop/shared";
import {
  editFollowUpItem,
  enqueueFollowUpItem,
  markFollowUpFailed,
  markFollowUpSending,
  markFollowUpSent,
  moveFollowUpItem,
  removeFollowUpItem,
  retryFollowUpItem,
  selectNextDispatchableItem,
  setFollowUpQueuePaused,
} from "./follow-up-queue";
import type { FollowUpQueueStorage } from "./follow-up-queue-persistence";

/**
 * Host hooks the follow-up controller needs from the shell model
 * (issue #10). Keeps queue state ownership in the model while the
 * dispatch policy lives here.
 */
export interface FollowUpControllerDeps {
  api: PiDesktopApi;
  storage?: FollowUpQueueStorage;
  createFollowUpId: () => string;
  now: () => number;
  getActiveThreadId: () => string | null;
  getAgentStatus: () => AgentSnapshot["status"];
  getContextRevision: () => number;
  /** Queue for a thread from current model state. */
  getQueue: (threadId: string) => FollowUpQueueState;
  /** Replace a queue in model state, persist it, and notify. */
  updateQueue: (queue: FollowUpQueueState) => void;
  /** Refresh/merge the agent snapshot after a successful delivery. */
  refreshAgentAfterDispatch: (
    contextRevisionAtDispatch: number,
  ) => Promise<void>;
  /** Surface an error in agent state (steer failures). */
  setAgentError: (message: string) => void;
}

export interface FollowUpController {
  /** Queues persisted at construction time (state hydration). */
  initialQueues: Record<string, FollowUpQueueState>;
  enqueueFollowUp: (
    text: string,
    images?: PromptImageAttachment[],
  ) => string | null;
  editFollowUp: (threadId: string, itemId: string, text: string) => void;
  deleteFollowUp: (threadId: string, itemId: string) => void;
  moveFollowUp: (threadId: string, itemId: string, offset: -1 | 1) => void;
  setFollowUpPaused: (threadId: string, paused: boolean) => void;
  retryFollowUp: (threadId: string, itemId: string) => void;
  dispatchFollowUps: () => Promise<void>;
  steerPrompt: (
    text: string,
    images?: PromptImageAttachment[],
  ) => Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function createFollowUpController(
  deps: FollowUpControllerDeps,
): FollowUpController {
  const { api, now } = deps;
  let dispatchInFlight = false;

  let initialQueues: Record<string, FollowUpQueueState> = {};
  try {
    initialQueues = deps.storage?.read() ?? {};
  } catch {
    initialQueues = {};
  }

  function getQueue(threadId: string): FollowUpQueueState {
    return deps.getQueue(threadId);
  }

  /**
   * Dispatch the head follow-up for the active thread when the agent is
   * idle. Exactly-once: the in-flight flag plus the item's `sending`
   * status prevent concurrent or repeated delivery, items run strictly
   * in order, and a failure marks the item `failed` (preserved at the
   * head) instead of dropping or skipping it.
   */
  async function maybeDispatchFollowUps(): Promise<void> {
    if (dispatchInFlight) {
      return;
    }

    const threadId = deps.getActiveThreadId();
    if (!threadId || deps.getAgentStatus() !== "ready") {
      return;
    }

    const item = selectNextDispatchableItem(getQueue(threadId));
    if (!item) {
      return;
    }

    dispatchInFlight = true;
    const dispatchContextRevision = deps.getContextRevision();

    try {
      deps.updateQueue(markFollowUpSending(getQueue(threadId), item.id, now()));

      if (item.images.length > 0) {
        await api.agent.prompt(item.text, [...item.images]);
      } else {
        await api.agent.prompt(item.text);
      }

      deps.updateQueue(markFollowUpSent(getQueue(threadId), item.id, now()));

      try {
        await deps.refreshAgentAfterDispatch(dispatchContextRevision);
      } catch {
        // The item was delivered; a snapshot refresh failure must not
        // turn a successful delivery into a failed queue entry.
      }
    } catch (error) {
      deps.updateQueue(
        markFollowUpFailed(
          getQueue(threadId),
          item.id,
          getErrorMessage(error, "Follow-up delivery failed"),
          now(),
        ),
      );
    } finally {
      dispatchInFlight = false;
    }

    // Chain the next queued item once this run has settled back to idle.
    if (deps.getAgentStatus() === "ready") {
      void maybeDispatchFollowUps();
    }
  }

  return {
    initialQueues,

    /**
     * Queue a follow-up for the active thread. Returns the new item id,
     * or null when there is no active thread or the text is empty. When
     * the agent is idle the item dispatches immediately; while a run is
     * active it waits and dispatches when the run finishes.
     */
    enqueueFollowUp(text, images) {
      const threadId = deps.getActiveThreadId();
      if (!threadId || !text.trim()) {
        return null;
      }

      const id = deps.createFollowUpId();
      deps.updateQueue(
        enqueueFollowUpItem(getQueue(threadId), {
          id,
          text,
          images,
          now: now(),
        }),
      );
      void maybeDispatchFollowUps();
      return id;
    },

    editFollowUp(threadId, itemId, text) {
      deps.updateQueue(
        editFollowUpItem(getQueue(threadId), itemId, { text, now: now() }),
      );
    },

    deleteFollowUp(threadId, itemId) {
      deps.updateQueue(removeFollowUpItem(getQueue(threadId), itemId));
    },

    moveFollowUp(threadId, itemId, offset) {
      deps.updateQueue(moveFollowUpItem(getQueue(threadId), itemId, offset));
    },

    setFollowUpPaused(threadId, paused) {
      deps.updateQueue(setFollowUpQueuePaused(getQueue(threadId), paused));
      if (!paused) {
        void maybeDispatchFollowUps();
      }
    },

    retryFollowUp(threadId, itemId) {
      deps.updateQueue(retryFollowUpItem(getQueue(threadId), itemId, now()));
      void maybeDispatchFollowUps();
    },

    dispatchFollowUps: maybeDispatchFollowUps,

    /**
     * Steer the active run without cancelling it. Callers gate this on
     * the shell `supportsSteer` capability; failures surface as agent
     * error state.
     */
    async steerPrompt(text, images) {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      try {
        if (images && images.length > 0) {
          await api.agent.steer(trimmed, [...images]);
        } else {
          await api.agent.steer(trimmed);
        }
      } catch (error) {
        deps.setAgentError(getErrorMessage(error, "Steer failed"));
      }
    },
  };
}
