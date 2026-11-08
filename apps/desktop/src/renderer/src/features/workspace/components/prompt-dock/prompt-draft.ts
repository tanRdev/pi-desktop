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

/** Restore the selected thread before persisting its next draft. */
export function usePersistDraft(
  threadId: string | null,
  draft: string,
  onDraftChange: (draft: string) => void,
): void {
  const restored = React.useRef<{
    threadId: string | null;
    value: string;
  } | null>(null);
  const selectedThread = React.useRef<string | null | undefined>(undefined);

  React.useLayoutEffect(() => {
    if (selectedThread.current === threadId) return;
    const initialSelection = selectedThread.current === undefined;
    selectedThread.current = threadId;
    const savedDraft = readDraft(threadId);
    const value = initialSelection && !savedDraft ? draft : savedDraft;
    restored.current = { threadId, value };
    if (draft !== value) onDraftChange(value);
  }, [threadId, draft, onDraftChange]);

  React.useEffect(() => {
    if (restored.current) {
      if (
        restored.current.threadId !== threadId ||
        restored.current.value !== draft
      )
        return;
      restored.current = null;
    }
    writeDraft(threadId, draft);
  }, [threadId, draft]);
}
