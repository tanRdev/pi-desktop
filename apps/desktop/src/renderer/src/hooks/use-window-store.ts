/**
 * React hook for the window store.
 * Provides reactive access to window state.
 */

import type { CanvasWindow } from "@pidesk/shared";
import { useMemo, useSyncExternalStore } from "react";
import {
  computeDragPosition,
  computeResizeGeometry,
} from "../components/canvas/canvas-geometry";
import {
  createWindowStore,
  type WindowStore,
  type WindowStoreState,
} from "../stores/window-store";

// Singleton store instance
let windowStoreInstance: WindowStore | null = null;

function getWindowStore(): WindowStore {
  if (!windowStoreInstance) {
    windowStoreInstance = createWindowStore();
  }
  return windowStoreInstance;
}

/**
 * Hook to access the window store.
 * Returns the store instance and reactive state.
 */
export function useWindowStore() {
  const store = useMemo(() => getWindowStore(), []);
  const state = useSyncExternalStore<WindowStoreState>(
    store.subscribe,
    store.getState,
    store.getState,
  );

  return {
    state,
    store,
    // Convenience methods
    createWindow: store.createWindow.bind(store),
    closeWindow: store.closeWindow.bind(store),
    focusWindow: store.focusWindow.bind(store),
    moveWindow: store.moveWindow.bind(store),
    resizeWindow: store.resizeWindow.bind(store),
    updateWindow: store.updateWindow.bind(store),
    setDirty: store.setDirty.bind(store),
    setSnapPreview: store.setSnapPreview.bind(store),
    clearAll: store.clearAll.bind(store),
  };
}

/**
 * Hook to get a specific window by ID.
 */
export function useWindow(windowId: string | null): CanvasWindow | null {
  const { state } = useWindowStore();

  if (!windowId) return null;
  return state.layout.windows.find((w) => w.id === windowId) ?? null;
}

/**
 * Hook to get all windows of a specific kind.
 */
export function useWindowsByKind(kind: CanvasWindow["kind"]): CanvasWindow[] {
  const { state } = useWindowStore();
  return state.layout.windows.filter((w) => w.kind === kind);
}

/**
 * Hook to get the focused window.
 */
export function useFocusedWindow(): CanvasWindow | null {
  const { state } = useWindowStore();

  if (!state.layout.focusedWindowId) return null;
  return (
    state.layout.windows.find((w) => w.id === state.layout.focusedWindowId) ??
    null
  );
}

/**
 * Hook for window drag operations.
 * Handles move, snap preview, and focus.
 */
export function useWindowDrag(windowId: string) {
  const { state, store } = useWindowStore();
  const window = state.layout.windows.find((w) => w.id === windowId);

  if (!window) {
    return {
      isDragging: false,
      onDragStart: () => {},
      onDrag: () => {},
      onDragEnd: () => {},
    };
  }

  let dragStart: {
    x: number;
    y: number;
    windowX: number;
    windowY: number;
  } | null = null;

  const onDragStart = (e: React.MouseEvent) => {
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      windowX: window.x,
      windowY: window.y,
    };
    store.focusWindow(windowId);
  };

  const onDrag = (e: MouseEvent) => {
    if (!dragStart) return;

    const gridSize = state.layout.snapGridSize;
    const pos = computeDragPosition(
      { x: dragStart.windowX, y: dragStart.windowY },
      { clientX: dragStart.x, clientY: dragStart.y },
      { clientX: e.clientX, clientY: e.clientY },
      gridSize,
    );

    store.moveWindow(windowId, pos.x, pos.y);
  };

  const onDragEnd = () => {
    dragStart = null;
    store.setSnapPreview(null);
  };

  return {
    isDragging: dragStart !== null,
    onDragStart,
    onDrag,
    onDragEnd,
  };
}

/**
 * Hook for window resize operations.
 */
export function useWindowResize(windowId: string) {
  const { state, store } = useWindowStore();
  const window = state.layout.windows.find((w) => w.id === windowId);

  if (!window) {
    return {
      onResizeStart: () => {},
      onResize: () => {},
      onResizeEnd: () => {},
    };
  }

  let resizeStart: {
    x: number;
    y: number;
    width: number;
    height: number;
    direction: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  } | null = null;

  const onResizeStart = (
    e: React.MouseEvent,
    direction: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
  ) => {
    e.stopPropagation();
    resizeStart = {
      x: e.clientX,
      y: e.clientY,
      width: window.width,
      height: window.height,
      direction,
    };
  };

  const onResize = (e: MouseEvent) => {
    if (!resizeStart) return;

    const gridSize = state.layout.snapGridSize;
    const g = computeResizeGeometry(
      {
        x: window.x,
        y: window.y,
        width: resizeStart.width,
        height: resizeStart.height,
      },
      resizeStart.direction,
      { clientX: resizeStart.x, clientY: resizeStart.y },
      { clientX: e.clientX, clientY: e.clientY },
      gridSize,
    );

    store.resizeWindow(windowId, g.width, g.height);
  };

  const onResizeEnd = () => {
    resizeStart = null;
  };

  return {
    onResizeStart,
    onResize,
    onResizeEnd,
  };
}

// Re-export types
export type { WindowStore, WindowStoreState };
