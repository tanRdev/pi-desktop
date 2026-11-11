import type { PromptImageAttachment } from "./agent.js";

/**
 * Per-thread follow-up queue model (issue #10).
 *
 * A follow-up is a prompt the user submitted while a run was already active
 * on the thread. It is queued instead of cancelling the current run and is
 * dispatched exactly once, in queue order, when the run finishes.
 */

/**
 * Explicit delivery status of a queued follow-up.
 * - `queued`: waiting to be dispatched.
 * - `sending`: dispatch is in flight (guards against double delivery).
 * - `sent`: delivered to the runtime exactly once; retained as history
 *   until the user deletes it.
 * - `failed`: delivery failed; the item (text + images) is preserved so
 *   the user can retry, edit, or delete it without losing context.
 */
export type FollowUpDeliveryStatus = "failed" | "queued" | "sending" | "sent";

export interface FollowUpItem {
  id: string;
  threadId: string;
  text: string;
  /** Typed image attachments delivered with the prompt text. */
  images: PromptImageAttachment[];
  status: FollowUpDeliveryStatus;
  createdAt: number;
  updatedAt: number;
  /** Number of dispatch attempts (incremented on every send try). */
  attempts: number;
  /** Message from the most recent failed attempt, or null. */
  lastError: string | null;
}

/** Queue for one thread. Order is the `items` array order. */
export interface FollowUpQueueState {
  threadId: string;
  /** When true, queued items are held and not auto-dispatched. */
  paused: boolean;
  items: FollowUpItem[];
}
