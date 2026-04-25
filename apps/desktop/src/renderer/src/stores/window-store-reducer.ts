import type { WorkspaceWindow } from "@pi-desktop/shared";

import type { WindowUpdates } from "./window-store";

type ManagedWindowFields = {
  id?: string;
  isFocused?: boolean;
  zIndex?: number;
};

export function applyWindowUpdates(
  window: WorkspaceWindow,
  updates: WindowUpdates & ManagedWindowFields,
): WorkspaceWindow {
  const {
    id: _ignoredId,
    isFocused: _ignoredFocus,
    zIndex: _ignoredZIndex,
    ...safeUpdates
  } = updates;

  switch (window.kind) {
    case "file":
      return { ...window, ...safeUpdates };
    case "terminal":
      return { ...window, ...safeUpdates };
    case "chat":
      return { ...window, ...safeUpdates };
    case "note":
      return { ...window, ...safeUpdates };
    case "git":
      return { ...window, ...safeUpdates };
    case "search":
      return { ...window, ...safeUpdates };
    case "graph":
      return { ...window, ...safeUpdates };
    case "image":
      return { ...window, ...safeUpdates };
  }
}

export function pickNextFocusableWindowId(
  windows: WorkspaceWindow[],
): string | null {
  const focusableWindows = windows.filter(
    (window) => window.state !== "minimized",
  );
  if (focusableWindows.length === 0) {
    return null;
  }

  const sortedByZIndex = [...focusableWindows].sort(
    (a, b) => b.zIndex - a.zIndex,
  );
  return sortedByZIndex[0]?.id ?? null;
}

export function syncFocusedWindowState(
  windows: WorkspaceWindow[],
  focusedWindowId: string | null,
): WorkspaceWindow[] {
  return windows.map((window) => ({
    ...window,
    isFocused: window.id === focusedWindowId,
  }));
}
