import type {
  FollowUpItem,
  FollowUpQueueState,
  PromptImageAttachment,
  PromptImageMimeType,
} from "@pi-desktop/shared";

/**
 * Persistence support for follow-up queues (issue #10).
 *
 * The shell model stays storage-agnostic: callers inject a
 * `FollowUpQueueStorage` adapter (the renderer backs it with
 * localStorage, following the existing prompt-draft pattern). All data
 * coming back from storage is sanitized defensively, mirroring the
 * workspace-session migration style: malformed entries are dropped
 * instead of breaking the queue.
 */
export interface FollowUpQueueStorage {
  read(): Record<string, FollowUpQueueState>;
  write(queues: Record<string, FollowUpQueueState>): void;
}

const IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DELIVERY_STATUSES: ReadonlySet<string> = new Set([
  "failed",
  "queued",
  "sending",
  "sent",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeImage(value: unknown): PromptImageAttachment | null {
  if (!isRecord(value)) return null;
  if (value.type !== "image") return null;
  if (
    typeof value.mimeType !== "string" ||
    !IMAGE_MIME_TYPES.has(value.mimeType)
  ) {
    return null;
  }
  if (typeof value.data !== "string" || value.data.length === 0) return null;

  return {
    type: "image",
    mimeType: value.mimeType as PromptImageMimeType,
    data: value.data,
    ...(typeof value.name === "string" ? { name: value.name } : {}),
  };
}

function sanitizeItem(value: unknown, threadId: string): FollowUpItem | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  if (typeof value.text !== "string" || value.text.trim().length === 0)
    return null;
  if (
    typeof value.status !== "string" ||
    !DELIVERY_STATUSES.has(value.status)
  ) {
    return null;
  }

  const images = Array.isArray(value.images)
    ? value.images
        .map(sanitizeImage)
        .filter((image): image is PromptImageAttachment => image !== null)
    : [];

  return {
    id: value.id,
    threadId,
    text: value.text,
    images,
    // A persisted `sending` item means the app stopped mid-delivery; the
    // send may or may not have reached the runtime. Requeue it as
    // `failed` (preserved, never silently resent) so the user decides.
    status:
      value.status === "sending"
        ? "failed"
        : (value.status as FollowUpItem["status"]),
    createdAt: typeof value.createdAt === "number" ? value.createdAt : 0,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
    attempts: typeof value.attempts === "number" ? value.attempts : 0,
    lastError:
      value.status === "sending"
        ? "Delivery was interrupted before it completed"
        : typeof value.lastError === "string"
          ? value.lastError
          : null,
  };
}

export function sanitizeFollowUpQueue(
  value: unknown,
  threadId: string,
): FollowUpQueueState | null {
  if (!isRecord(value)) return null;

  const items = Array.isArray(value.items)
    ? value.items
        .map((item) => sanitizeItem(item, threadId))
        .filter((item): item is FollowUpItem => item !== null)
    : [];

  return { threadId, paused: value.paused === true, items };
}

export function sanitizeFollowUpQueues(
  value: unknown,
): Record<string, FollowUpQueueState> {
  if (!isRecord(value)) return {};

  const queues: Record<string, FollowUpQueueState> = {};
  for (const [threadId, queue] of Object.entries(value)) {
    const sanitized = sanitizeFollowUpQueue(queue, threadId);
    if (sanitized) {
      queues[threadId] = sanitized;
    }
  }
  return queues;
}
