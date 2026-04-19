import * as React from "react";

/**
 * Per-thread prompt history persisted in localStorage.
 *
 * Up/Down cycles through the last N submitted prompts for the active
 * thread. A fresh in-progress buffer is preserved so the user can return
 * to what they were typing by pressing Down past the newest history entry.
 */

const HISTORY_KEY_PREFIX = "pi:prompt-history:";
const HISTORY_MAX = 50;

function historyKey(threadId: string): string {
  return `${HISTORY_KEY_PREFIX}${threadId}`;
}

function safeGetStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readHistory(threadId: string | null): string[] {
  if (!threadId) return [];
  const storage = safeGetStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(historyKey(threadId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string") out.push(item);
    }
    return out;
  } catch {
    return [];
  }
}

export function appendHistory(threadId: string | null, entry: string): void {
  if (!threadId) return;
  const trimmed = entry.trim();
  if (trimmed.length === 0) return;
  const storage = safeGetStorage();
  if (!storage) return;
  const current = readHistory(threadId);
  // De-dupe consecutive identical entries
  if (current[current.length - 1] === trimmed) return;
  const next = [...current, trimmed].slice(-HISTORY_MAX);
  try {
    storage.setItem(historyKey(threadId), JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

export interface PromptHistoryApi {
  /** Push a submitted prompt into history. */
  push: (entry: string) => void;
  /** Cycle to an older entry. Returns the new draft or null if unchanged. */
  previous: (currentDraft: string) => string | null;
  /** Cycle to a newer entry. Returns the new draft or null if unchanged. */
  next: () => string | null;
  /** Reset the cycling cursor (e.g. after user types). */
  reset: () => void;
}

/**
 * React hook providing history cycling for the active thread.
 */
export function usePromptHistory(threadId: string | null): PromptHistoryApi {
  // Cursor: -1 = not cycling. 0..n-1 = viewing history[history.length - 1 - cursor].
  const cursorRef = React.useRef<number>(-1);
  const pendingDraftRef = React.useRef<string>("");

  // Reset cursor whenever thread changes. `threadId` is consumed purely as a
  // key; we intentionally read it to satisfy the dependency linter.
  React.useEffect(() => {
    void threadId;
    cursorRef.current = -1;
    pendingDraftRef.current = "";
  }, [threadId]);

  const push = React.useCallback(
    (entry: string) => {
      appendHistory(threadId, entry);
      cursorRef.current = -1;
      pendingDraftRef.current = "";
    },
    [threadId],
  );

  const previous = React.useCallback(
    (currentDraft: string): string | null => {
      const history = readHistory(threadId);
      if (history.length === 0) return null;

      if (cursorRef.current === -1) {
        pendingDraftRef.current = currentDraft;
        cursorRef.current = 0;
      } else if (cursorRef.current < history.length - 1) {
        cursorRef.current += 1;
      } else {
        return null;
      }
      const entry = history[history.length - 1 - cursorRef.current];
      return entry ?? null;
    },
    [threadId],
  );

  const nextFn = React.useCallback((): string | null => {
    const history = readHistory(threadId);
    if (cursorRef.current === -1) return null;

    if (cursorRef.current === 0) {
      cursorRef.current = -1;
      return pendingDraftRef.current;
    }
    cursorRef.current -= 1;
    const entry = history[history.length - 1 - cursorRef.current];
    return entry ?? null;
  }, [threadId]);

  const reset = React.useCallback(() => {
    cursorRef.current = -1;
    pendingDraftRef.current = "";
  }, []);

  return { push, previous, next: nextFn, reset };
}
