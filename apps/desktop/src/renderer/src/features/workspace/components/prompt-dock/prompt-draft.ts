import * as React from "react";

/**
 * Per-thread draft persistence in localStorage.
 *
 * Drafts survive app reloads and thread switches. When the user submits
 * a prompt the caller should `clear` the draft for the active thread.
 */

const DRAFT_KEY_PREFIX = "pi:prompt-draft:";

function draftKey(threadId: string): string {
  return `${DRAFT_KEY_PREFIX}${threadId}`;
}

function safeGetStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readDraft(threadId: string | null): string {
  if (!threadId) return "";
  const storage = safeGetStorage();
  if (!storage) return "";
  try {
    return storage.getItem(draftKey(threadId)) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(threadId: string | null, value: string): void {
  if (!threadId) return;
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    if (value.length === 0) {
      storage.removeItem(draftKey(threadId));
    } else {
      storage.setItem(draftKey(threadId), value);
    }
  } catch {
    // ignore quota errors
  }
}

export function clearDraft(threadId: string | null): void {
  writeDraft(threadId, "");
}

/**
 * Persist the current draft whenever it changes for the active thread.
 *
 * Note: reading the stored draft on thread change is intentionally left to
 * the caller so they can decide whether to override an in-memory draft.
 */
export function usePersistDraft(threadId: string | null, draft: string): void {
  React.useEffect(() => {
    writeDraft(threadId, draft);
  }, [threadId, draft]);
}
