import {
  type FollowUpQueueStorage,
  sanitizeFollowUpQueues,
} from "@pi-desktop/shell-model";

/**
 * localStorage-backed persistence for per-thread follow-up queues,
 * following the prompt-draft pattern
 * (`features/workspace/components/prompt-dock/prompt-draft.ts`): data
 * survives app reloads and thread switches, and storage failures
 * (quota, privacy mode) degrade to an in-memory queue instead of
 * throwing.
 */
const FOLLOW_UP_QUEUES_KEY = "pi:follow-up-queues:v1";

function safeGetStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createLocalFollowUpQueueStorage(): FollowUpQueueStorage {
  return {
    read() {
      const storage = safeGetStorage();
      if (!storage) return {};
      try {
        const raw = storage.getItem(FOLLOW_UP_QUEUES_KEY);
        if (!raw) return {};
        return sanitizeFollowUpQueues(JSON.parse(raw));
      } catch {
        return {};
      }
    },
    write(queues) {
      const storage = safeGetStorage();
      if (!storage) return;
      try {
        storage.setItem(FOLLOW_UP_QUEUES_KEY, JSON.stringify(queues));
      } catch {
        // Ignore quota errors — the in-memory queue stays authoritative.
      }
    },
  };
}
