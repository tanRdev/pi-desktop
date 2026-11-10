import type {
  FollowUpItem,
  FollowUpQueueState,
  PromptImageAttachment,
} from "@pi-desktop/shared";

/**
 * Pure per-thread follow-up queue operations (issue #10).
 *
 * Every function is immutable: it returns a new queue (or the same queue
 * reference when the operation is a no-op) and never mutates its input.
 * Dispatch invariants:
 * - Items are dispatched strictly in array order.
 * - Only the first non-`sent` item is dispatchable, and only when its
 *   status is `queued` — a `failed` head blocks the queue so order is
 *   preserved until the user retries, edits, or deletes it.
 * - A `sending` item is never dispatched again, which together with the
 *   dispatcher's in-flight guard gives exactly-once delivery.
 */

export function createEmptyFollowUpQueue(threadId: string): FollowUpQueueState {
  return { threadId, paused: false, items: [] };
}

export interface EnqueueFollowUpInput {
  id: string;
  text: string;
  images?: PromptImageAttachment[];
  now: number;
}

export function enqueueFollowUpItem(
  queue: FollowUpQueueState,
  input: EnqueueFollowUpInput,
): FollowUpQueueState {
  const text = input.text.trim();
  if (!text) {
    return queue;
  }

  const item: FollowUpItem = {
    id: input.id,
    threadId: queue.threadId,
    text,
    images: input.images ? [...input.images] : [],
    status: "queued",
    createdAt: input.now,
    updatedAt: input.now,
    attempts: 0,
    lastError: null,
  };

  return { ...queue, items: [...queue.items, item] };
}

/**
 * Edit the text (and optionally images) of a `queued` or `failed` item.
 * Editing a failed item keeps its `failed` status — use
 * `retryFollowUpItem` to requeue it. Sending/sent items are immutable.
 */
export function editFollowUpItem(
  queue: FollowUpQueueState,
  itemId: string,
  patch: { text?: string; images?: PromptImageAttachment[]; now: number },
): FollowUpQueueState {
  const index = queue.items.findIndex((item) => item.id === itemId);
  const item = queue.items[index];
  if (!item || (item.status !== "queued" && item.status !== "failed")) {
    return queue;
  }

  const text = patch.text !== undefined ? patch.text.trim() : item.text;
  if (!text) {
    return queue;
  }

  const items = [...queue.items];
  items[index] = {
    ...item,
    text,
    images: patch.images ? [...patch.images] : item.images,
    updatedAt: patch.now,
  };
  return { ...queue, items };
}

export function removeFollowUpItem(
  queue: FollowUpQueueState,
  itemId: string,
): FollowUpQueueState {
  const item = queue.items.find((entry) => entry.id === itemId);
  // A sending item is mid-delivery; deleting it would break exactly-once
  // bookkeeping, so it is not removable until it settles.
  if (!item || item.status === "sending") {
    return queue;
  }

  return {
    ...queue,
    items: queue.items.filter((entry) => entry.id !== itemId),
  };
}

/** Move an item by `offset` positions (-1 = earlier, +1 = later). */
export function moveFollowUpItem(
  queue: FollowUpQueueState,
  itemId: string,
  offset: -1 | 1,
): FollowUpQueueState {
  const index = queue.items.findIndex((item) => item.id === itemId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= queue.items.length) {
    return queue;
  }

  const current = queue.items[index];
  const other = queue.items[target];
  if (
    !current ||
    !other ||
    current.status === "sending" ||
    other.status === "sending"
  ) {
    return queue;
  }

  const items = [...queue.items];
  items[index] = other;
  items[target] = current;
  return { ...queue, items };
}

export function setFollowUpQueuePaused(
  queue: FollowUpQueueState,
  paused: boolean,
): FollowUpQueueState {
  if (queue.paused === paused) {
    return queue;
  }
  return { ...queue, paused };
}

/** Requeue a failed item so the dispatcher picks it up again. */
export function retryFollowUpItem(
  queue: FollowUpQueueState,
  itemId: string,
  now: number,
): FollowUpQueueState {
  const index = queue.items.findIndex((item) => item.id === itemId);
  const item = queue.items[index];
  if (!item || item.status !== "failed") {
    return queue;
  }

  const items = [...queue.items];
  items[index] = { ...item, status: "queued", lastError: null, updatedAt: now };
  return { ...queue, items };
}

/**
 * The next item eligible for dispatch: the first non-`sent` item, and
 * only when it is `queued`, the queue is not paused, and nothing is
 * already `sending`. Returns null when dispatch must wait.
 */
export function selectNextDispatchableItem(
  queue: FollowUpQueueState,
): FollowUpItem | null {
  if (queue.paused) {
    return null;
  }
  if (queue.items.some((item) => item.status === "sending")) {
    return null;
  }

  const head = queue.items.find((item) => item.status !== "sent");
  return head?.status === "queued" ? head : null;
}

export function markFollowUpSending(
  queue: FollowUpQueueState,
  itemId: string,
  now: number,
): FollowUpQueueState {
  const index = queue.items.findIndex((item) => item.id === itemId);
  const item = queue.items[index];
  if (!item || item.status !== "queued") {
    return queue;
  }

  const items = [...queue.items];
  items[index] = {
    ...item,
    status: "sending",
    attempts: item.attempts + 1,
    updatedAt: now,
  };
  return { ...queue, items };
}

export function markFollowUpSent(
  queue: FollowUpQueueState,
  itemId: string,
  now: number,
): FollowUpQueueState {
  const index = queue.items.findIndex((item) => item.id === itemId);
  const item = queue.items[index];
  if (!item || item.status !== "sending") {
    return queue;
  }

  const items = [...queue.items];
  items[index] = { ...item, status: "sent", lastError: null, updatedAt: now };
  return { ...queue, items };
}

/**
 * Mark a sending item as failed. The item keeps its text and images so
 * no context is lost, and it stays at the head of the queue.
 */
export function markFollowUpFailed(
  queue: FollowUpQueueState,
  itemId: string,
  error: string,
  now: number,
): FollowUpQueueState {
  const index = queue.items.findIndex((item) => item.id === itemId);
  const item = queue.items[index];
  if (!item || item.status !== "sending") {
    return queue;
  }

  const items = [...queue.items];
  items[index] = {
    ...item,
    status: "failed",
    lastError: error,
    updatedAt: now,
  };
  return { ...queue, items };
}
