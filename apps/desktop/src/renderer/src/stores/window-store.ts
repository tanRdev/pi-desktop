/**
 * Window state store for the canvas window manager.
 * Manages open windows, focus, z-order, and layout.
 */

import type {
  ChatWindow,
  FileWindow,
  GitWindow,
  GraphWindow,
  ImageWindow,
  NoteWindow,
  SearchWindow,
  TerminalWindow,
  WindowLayoutState,
  WindowPosition,
  WorkspaceWindow,
} from "@pi-desktop/shared";
import { createWindowFromAction } from "./window-store-create";
import { createWindowStoreHarness } from "./window-store-harness";
import {
  applyWindowUpdates,
  pickNextFocusableWindowId,
  syncFocusedWindowState,
} from "./window-store-reducer";

export {
  createWindowFromAction,
  generateWindowId,
  getCenteredWindowPosition,
  getDefaultWindowPosition,
  type WindowCreationOptions,
} from "./window-store-create";

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
  | { type: "CREATE_WINDOW"; payload: { window: WorkspaceWindow } }
  | { type: "CLOSE_WINDOW"; payload: { windowId: string } }
  | { type: "FOCUS_WINDOW"; payload: { windowId: string } }
  | { type: "MOVE_WINDOW"; payload: { windowId: string; x: number; y: number } }
  | {
      type: "RESIZE_WINDOW";
      payload: { windowId: string; width: number; height: number };
    }
  | {
      type: "SET_WINDOW_STATE";
      payload: { windowId: string; state: WorkspaceWindow["state"] };
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
  | { type: "SET_ZOOM"; payload: { zoom: number } }
  | { type: "ZOOM_IN" }
  | { type: "ZOOM_OUT" }
  | { type: "RESET_ZOOM" }
  | { type: "SET_PAN"; payload: { panX: number; panY: number } }
  | { type: "REORDER_WINDOWS"; payload: { fromIndex: number; toIndex: number } }
  | { type: "CLEAR_ALL" };

const DEFAULT_SNAP_GRID = 24;
const DEFAULT_ZOOM = 0.9;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export function createInitialWindowStoreState(): WindowStoreState {
  return {
    layout: {
      windows: [],
      nextZIndex: 1,
      focusedWindowId: null,
      snapGridSize: DEFAULT_SNAP_GRID,
      zoom: DEFAULT_ZOOM,
      panX: 0,
      panY: 0,
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
 * Window store reducer.
 */
export function windowReducer(
  state: WindowStoreState,
  action: WindowAction,
): WindowStoreState {
  switch (action.type) {
    case "CREATE_WINDOW": {
      const newWindow = action.payload.window;
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
      const windows = state.layout.windows.map((w): WorkspaceWindow => {
        if (w.id !== windowId) return w;
        if (w.kind === "file" || w.kind === "note") {
          return { ...w, isDirty };
        }
        return w;
      });
      return { ...state, layout: { ...state.layout, windows } };
    }

    case "SET_ZOOM": {
      const { zoom } = action.payload;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      return {
        ...state,
        layout: {
          ...state.layout,
          zoom: Math.round(clampedZoom * 100) / 100,
        },
      };
    }

    case "ZOOM_IN": {
      const newZoom = Math.min(MAX_ZOOM, state.layout.zoom + ZOOM_STEP);
      return {
        ...state,
        layout: {
          ...state.layout,
          zoom: Math.round(newZoom * 100) / 100,
        },
      };
    }

    case "ZOOM_OUT": {
      const newZoom = Math.max(MIN_ZOOM, state.layout.zoom - ZOOM_STEP);
      return {
        ...state,
        layout: {
          ...state.layout,
          zoom: Math.round(newZoom * 100) / 100,
        },
      };
    }

    case "RESET_ZOOM": {
      return {
        ...state,
        layout: {
          ...state.layout,
          zoom: DEFAULT_ZOOM,
          panX: 0,
          panY: 0,
        },
      };
    }

    case "SET_PAN": {
      const { panX, panY } = action.payload;
      return {
        ...state,
        layout: {
          ...state.layout,
          panX,
          panY,
        },
      };
    }

    case "REORDER_WINDOWS": {
      const { fromIndex, toIndex } = action.payload;
      const windows = [...state.layout.windows];
      const maxIndex = windows.length - 1;
      if (
        fromIndex < 0 ||
        fromIndex > maxIndex ||
        toIndex < 0 ||
        toIndex > maxIndex
      ) {
        return state;
      }
      const moved = windows[fromIndex];
      if (!moved) return state;
      windows.splice(fromIndex, 1);
      windows.splice(toIndex, 0, moved);
      return {
        ...state,
        layout: {
          ...state.layout,
          windows,
        },
      };
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
  return createWindowStoreHarness<
    WindowStoreState,
    WindowAction,
    WorkspaceWindow,
    WindowUpdates,
    NonNullable<WindowStoreState["snapPreview"]>
  >({
    createInitialState: createInitialWindowStoreState,
    reduce: windowReducer,
    createWindowFromAction,
    actions: {
      createWindow: (window) => ({
        type: "CREATE_WINDOW",
        payload: { window },
      }),
      closeWindow: (windowId) => ({
        type: "CLOSE_WINDOW",
        payload: { windowId },
      }),
      focusWindow: (windowId) => ({
        type: "FOCUS_WINDOW",
        payload: { windowId },
      }),
      moveWindow: (windowId, x, y) => ({
        type: "MOVE_WINDOW",
        payload: { windowId, x, y },
      }),
      resizeWindow: (windowId, width, height) => ({
        type: "RESIZE_WINDOW",
        payload: { windowId, width, height },
      }),
      updateWindow: (windowId, updates) => ({
        type: "UPDATE_WINDOW",
        payload: { windowId, updates },
      }),
      setDirty: (windowId, isDirty) => ({
        type: "SET_DIRTY",
        payload: { windowId, isDirty },
      }),
      setZoom: (zoom) => ({ type: "SET_ZOOM", payload: { zoom } }),
      zoomIn: () => ({ type: "ZOOM_IN" }),
      zoomOut: () => ({ type: "ZOOM_OUT" }),
      resetZoom: () => ({ type: "RESET_ZOOM" }),
      setPan: (panX, panY) => ({ type: "SET_PAN", payload: { panX, panY } }),
      reorderWindows: (fromIndex, toIndex) => ({
        type: "REORDER_WINDOWS",
        payload: { fromIndex, toIndex },
      }),
      setSnapPreview: (preview) => ({
        type: "SET_SNAP_PREVIEW",
        payload: preview,
      }),
      clearAll: () => ({ type: "CLEAR_ALL" }),
    },
  });
}

export type WindowStore = ReturnType<typeof createWindowStore>;
