/**
 * Window state store for the canvas window manager.
 * Manages open windows, focus, z-order, and layout.
 */

import type {
  CanvasWindow,
  CanvasWindowBase,
  ChatWindow,
  CreateWindowAction,
  FileWindow,
  GitWindow,
  GraphWindow,
  ImageWindow,
  NoteWindow,
  SearchWindow,
  TerminalWindow,
  WindowLayoutState,
  WindowPosition,
} from "@pidesk/shared";

/**
 * Window store state.
 */
export interface WindowStoreState {
  /** Layout state for all windows */
  layout: WindowLayoutState;
  /** Whether drag/snap preview is active */
  snapPreview: { windowId: string; position: WindowPosition } | null;
}

/**
 * Window store actions.
 */
export type WindowUpdates =
  | Omit<Partial<FileWindow>, "kind">
  | Omit<Partial<TerminalWindow>, "kind">
  | Omit<Partial<ChatWindow>, "kind">
  | Omit<Partial<NoteWindow>, "kind">
  | Omit<Partial<GitWindow>, "kind">
  | Omit<Partial<SearchWindow>, "kind">
  | Omit<Partial<GraphWindow>, "kind">
  | Omit<Partial<ImageWindow>, "kind">;

export type WindowAction =
  | { type: "CREATE_WINDOW"; payload: { window: CanvasWindow } }
  | { type: "CLOSE_WINDOW"; payload: { windowId: string } }
  | { type: "FOCUS_WINDOW"; payload: { windowId: string } }
  | { type: "MOVE_WINDOW"; payload: { windowId: string; x: number; y: number } }
  | {
      type: "RESIZE_WINDOW";
      payload: { windowId: string; width: number; height: number };
    }
  | {
      type: "SET_WINDOW_STATE";
      payload: { windowId: string; state: CanvasWindow["state"] };
    }
  | {
      type: "SET_SNAP_PREVIEW";
      payload: { windowId: string; position: WindowPosition } | null;
    }
  | {
      type: "UPDATE_WINDOW";
      payload: { windowId: string; updates: WindowUpdates };
    }
  | { type: "SET_DIRTY"; payload: { windowId: string; isDirty: boolean } }
  | { type: "CLEAR_ALL" };

const DEFAULT_WINDOW_WIDTH = 560;
const DEFAULT_WINDOW_HEIGHT = 380;
const DEFAULT_SNAP_GRID = 16;

export function createInitialWindowStoreState(): WindowStoreState {
  return {
    layout: {
      windows: [],
      nextZIndex: 1,
      focusedWindowId: null,
      snapGridSize: DEFAULT_SNAP_GRID,
    },
    snapPreview: null,
  };
}

/**
 * Initial window reducer state.
 */
export const initialWindowStoreState: WindowStoreState =
  createInitialWindowStoreState();

/**
 * Generate a unique window ID.
 */
export function generateWindowId(kind: CanvasWindow["kind"]): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get default window position (cascading from top-left).
 */
export function getDefaultWindowPosition(existingWindows: CanvasWindow[]): {
  x: number;
  y: number;
} {
  const cascadeOffset = 32;
  const maxOffset = 200;

  // Calculate cascade position based on existing windows
  const count = existingWindows.length;
  const offset = Math.min(count * cascadeOffset, maxOffset);

  return {
    x: 100 + offset,
    y: 80 + offset,
  };
}

/**
 * Create a new window from an action.
 */
export function createWindowFromAction(
  action: CreateWindowAction,
  existingWindows: CanvasWindow[],
  nextZIndex: number,
  cwd?: string,
): CanvasWindow {
  const id = generateWindowId(action.kind);
  const position = getDefaultWindowPosition(existingWindows);

  const base: Omit<CanvasWindowBase, "kind"> = {
    id,
    title: "",
    x: position.x,
    y: position.y,
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    zIndex: nextZIndex,
    isFocused: true,
    state: "normal",
  };

  switch (action.kind) {
    case "file": {
      const win: FileWindow = {
        ...base,
        kind: "file",
        title: action.filePath.split(/[/\\]/).pop() ?? action.filePath,
        filePath: action.filePath,
        isDirty: false,
      };
      return win;
    }
    case "terminal": {
      const win: TerminalWindow = {
        ...base,
        kind: "terminal",
        title: "Terminal",
        terminalId: id,
        backend: action.backend,
        cwd: action.cwd ?? cwd ?? "/",
      };
      return win;
    }
    case "chat": {
      const win: ChatWindow = {
        ...base,
        kind: "chat",
        title: action.title ?? "Chat",
        threadId: action.threadId,
      };
      return win;
    }
    case "note": {
      const win: NoteWindow = {
        ...base,
        kind: "note",
        title: "New Note",
        noteId: id,
        isDirty: false,
      };
      return win;
    }
    case "git": {
      const win: GitWindow = {
        ...base,
        kind: "git",
        title: "Git",
        terminalId: id,
        repositoryPath: action.repositoryPath,
      };
      return win;
    }
    case "search": {
      const win: SearchWindow = {
        ...base,
        kind: "search",
        title: "Search",
        query: "",
        results: [],
      };
      return win;
    }
    case "graph": {
      const win: GraphWindow = {
        ...base,
        kind: "graph",
        title: "Graph",
        filters: {
          showFiles: true,
          showTerminals: true,
          showNotes: true,
          showThreadLinks: true,
          showMentions: true,
        },
      };
      return win;
    }
    case "image": {
      const win: ImageWindow = {
        ...base,
        kind: "image",
        title: action.filePath.split(/[/\\]/).pop() ?? action.filePath,
        filePath: action.filePath,
      };
      return win;
    }
  }
}

function applyWindowUpdates(
  window: CanvasWindow,
  updates: WindowUpdates,
): CanvasWindow {
  const {
    id: _ignoredId,
    isFocused: _ignoredFocus,
    zIndex: _ignoredZIndex,
    ...safeUpdates
  } = updates as WindowUpdates & {
    id?: string;
    isFocused?: boolean;
    zIndex?: number;
  };

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

function pickNextFocusableWindowId(windows: CanvasWindow[]): string | null {
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

function syncFocusedWindowState(
  windows: CanvasWindow[],
  focusedWindowId: string | null,
): CanvasWindow[] {
  return windows.map((window) => ({
    ...window,
    isFocused: window.id === focusedWindowId,
  }));
}

/**
 * Window store reducer.
 */
export function windowReducer(
  state: WindowStoreState,
  action: WindowAction,
): WindowStoreState {
  switch (action.type) {
    case "CREATE_WINDOW": {
      const newWindow = action.payload.window;
      // Defocus all other windows
      const windows = state.layout.windows.map((w) => ({
        ...w,
        isFocused: false,
      }));
      return {
        ...state,
        layout: {
          ...state.layout,
          windows: [...windows, newWindow],
          nextZIndex: state.layout.nextZIndex + 1,
          focusedWindowId: newWindow.id,
        },
        snapPreview: null,
      };
    }

    case "CLOSE_WINDOW": {
      const { windowId } = action.payload;
      const windows = state.layout.windows.filter((w) => w.id !== windowId);
      const wasFocused = state.layout.focusedWindowId === windowId;

      const focusedWindowId = wasFocused
        ? pickNextFocusableWindowId(windows)
        : state.layout.focusedWindowId;

      return {
        ...state,
        layout: {
          ...state.layout,
          windows: syncFocusedWindowState(windows, focusedWindowId),
          focusedWindowId,
        },
      };
    }

    case "FOCUS_WINDOW": {
      const { windowId } = action.payload;
      const window = state.layout.windows.find((w) => w.id === windowId);
      if (!window) return state;

      const newZIndex = state.layout.nextZIndex;
      const windows = state.layout.windows.map((w) => ({
        ...w,
        isFocused: w.id === windowId,
        zIndex: w.id === windowId ? newZIndex : w.zIndex,
      }));

      return {
        ...state,
        layout: {
          ...state.layout,
          windows,
          nextZIndex: newZIndex + 1,
          focusedWindowId: windowId,
        },
      };
    }

    case "MOVE_WINDOW": {
      const { windowId, x, y } = action.payload;
      const windows = state.layout.windows.map((w) =>
        w.id === windowId ? { ...w, x, y } : w,
      );
      return { ...state, layout: { ...state.layout, windows } };
    }

    case "RESIZE_WINDOW": {
      const { windowId, width, height } = action.payload;
      const windows = state.layout.windows.map((w) =>
        w.id === windowId ? { ...w, width, height } : w,
      );
      return { ...state, layout: { ...state.layout, windows } };
    }

    case "SET_WINDOW_STATE": {
      const { windowId, state: windowState } = action.payload;
      const windows = state.layout.windows.map((w) =>
        w.id === windowId ? { ...w, state: windowState } : w,
      );

      if (
        windowState === "minimized" &&
        state.layout.focusedWindowId === windowId
      ) {
        const focusedWindowId = pickNextFocusableWindowId(windows);

        return {
          ...state,
          layout: {
            ...state.layout,
            windows: syncFocusedWindowState(windows, focusedWindowId),
            focusedWindowId,
          },
        };
      }

      return { ...state, layout: { ...state.layout, windows } };
    }

    case "SET_SNAP_PREVIEW": {
      return { ...state, snapPreview: action.payload };
    }

    case "UPDATE_WINDOW": {
      const { windowId, updates } = action.payload;
      const windows = state.layout.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }

        const nextWindow = applyWindowUpdates(w, updates);
        if (w.state === nextWindow.state) {
          return nextWindow;
        }

        return { ...nextWindow, state: nextWindow.state };
      });

      const updatedWindow = windows.find((window) => window.id === windowId);
      if (!updatedWindow) {
        return { ...state, layout: { ...state.layout, windows } };
      }

      if (
        updatedWindow.state === "minimized" &&
        state.layout.focusedWindowId === windowId
      ) {
        const focusedWindowId = pickNextFocusableWindowId(windows);

        return {
          ...state,
          layout: {
            ...state.layout,
            windows: syncFocusedWindowState(windows, focusedWindowId),
            focusedWindowId,
          },
        };
      }

      return { ...state, layout: { ...state.layout, windows } };
    }

    case "SET_DIRTY": {
      const { windowId, isDirty } = action.payload;
      const windows = state.layout.windows.map((w): CanvasWindow => {
        if (w.id !== windowId) return w;
        if (w.kind === "file" || w.kind === "note") {
          return { ...w, isDirty };
        }
        return w;
      });
      return { ...state, layout: { ...state.layout, windows } };
    }

    case "CLEAR_ALL": {
      return createInitialWindowStoreState();
    }

    default:
      return state;
  }
}

/**
 * Create a local window reducer harness.
 * This is retained for tests and non-authoritative reducer use only.
 */
export function createWindowStore() {
  let state: WindowStoreState = createInitialWindowStoreState();
  const listeners = new Set<(state: WindowStoreState) => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState(): WindowStoreState {
      return state;
    },

    subscribe(listener: (state: WindowStoreState) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispatch(action: WindowAction): void {
      state = windowReducer(state, action);
      notify();
    },

    createWindow(action: CreateWindowAction, cwd?: string): CanvasWindow {
      const window = createWindowFromAction(
        action,
        state.layout.windows,
        state.layout.nextZIndex,
        cwd,
      );
      this.dispatch({ type: "CREATE_WINDOW", payload: { window } });
      return window;
    },

    closeWindow(windowId: string): void {
      this.dispatch({ type: "CLOSE_WINDOW", payload: { windowId } });
    },

    focusWindow(windowId: string): void {
      this.dispatch({ type: "FOCUS_WINDOW", payload: { windowId } });
    },

    moveWindow(windowId: string, x: number, y: number): void {
      this.dispatch({ type: "MOVE_WINDOW", payload: { windowId, x, y } });
    },

    resizeWindow(windowId: string, width: number, height: number): void {
      this.dispatch({
        type: "RESIZE_WINDOW",
        payload: { windowId, width, height },
      });
    },

    updateWindow(windowId: string, updates: WindowUpdates): void {
      this.dispatch({ type: "UPDATE_WINDOW", payload: { windowId, updates } });
    },

    setDirty(windowId: string, isDirty: boolean): void {
      this.dispatch({ type: "SET_DIRTY", payload: { windowId, isDirty } });
    },

    setSnapPreview(
      preview: { windowId: string; position: WindowPosition } | null,
    ): void {
      this.dispatch({ type: "SET_SNAP_PREVIEW", payload: preview });
    },

    clearAll(): void {
      this.dispatch({ type: "CLEAR_ALL" });
    },
  };
}

export type WindowStore = ReturnType<typeof createWindowStore>;
