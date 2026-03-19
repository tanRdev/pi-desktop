/**
 * Canvas container - manages all windows on the canvas.
 */

import type { CanvasWindow } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useWindowStore } from "../../hooks/use-window-store";
import { computeDragPosition, computeResizeGeometry } from "./canvas-geometry";
import { type ResizeDirection, WindowChrome } from "./window-chrome";

/**
 * Props for CanvasContainer component.
 */
export interface CanvasContainerProps {
  /** Render content for a specific window */
  renderWindowContent: (window: CanvasWindow) => React.ReactNode;
  /** Called after a window receives focus */
  onWindowFocus?: (window: CanvasWindow) => void;
  /** Additional class name */
  className?: string;
}

interface CanvasWindowFrameProps {
  win: CanvasWindow;
  content: React.ReactNode;
  onClose?: () => void;
  onFocus?: () => void;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent, direction: ResizeDirection) => void;
}

function CanvasWindowFrame({
  win,
  content,
  onClose,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onDragStart,
  onResizeStart,
}: CanvasWindowFrameProps) {
  return (
    <WindowChrome
      window={win}
      onClose={onClose}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onDragStart={onDragStart}
      onResizeStart={onResizeStart}
    >
      {content}
    </WindowChrome>
  );
}

/**
 * Canvas container component - renders all windows on a canvas.
 */
export function CanvasContainer({
  renderWindowContent,
  onWindowFocus,
  className,
}: CanvasContainerProps) {
  const { state, store } = useWindowStore();

  // Handle drag
  const handleDragStart = React.useCallback(
    (windowId: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      store.setDraggingWindowId(windowId);

      const startX = e.clientX;
      const startY = e.clientY;
      const win = state.layout.windows.find((w) => w.id === windowId);
      if (!win) return;

      const startWindowX = win.x;
      const startWindowY = win.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const gridSize = state.layout.snapGridSize;

        const pos = computeDragPosition(
          { x: startWindowX, y: startWindowY },
          { clientX: startX, clientY: startY },
          { clientX: moveEvent.clientX, clientY: moveEvent.clientY },
          gridSize,
        );

        // Move the actual window while also showing snap preview
        store.moveWindow(windowId, pos.x, pos.y);
        store.setSnapPreview({
          windowId,
          position: {
            x: pos.x,
            y: pos.y,
            width: win.width,
            height: win.height,
          },
        });
      };

      const handleMouseUp = () => {
        store.setDraggingWindowId(null);
        store.setSnapPreview(null);
        globalThis.window.removeEventListener("mousemove", handleMouseMove);
        globalThis.window.removeEventListener("mouseup", handleMouseUp);
      };

      globalThis.window.addEventListener("mousemove", handleMouseMove);
      globalThis.window.addEventListener("mouseup", handleMouseUp);
    },
    [state.layout.windows, state.layout.snapGridSize, store],
  );

  // Handle resize
  const handleResizeStart = React.useCallback(
    (windowId: string) => (e: React.MouseEvent, direction: ResizeDirection) => {
      e.preventDefault();
      e.stopPropagation();
      store.setResizingWindowId(windowId);

      const startX = e.clientX;
      const startY = e.clientY;
      const win = state.layout.windows.find((w) => w.id === windowId);
      if (!win) return;

      const startWidth = win.width;
      const startHeight = win.height;
      const startWindowX = win.x;
      const startWindowY = win.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const gridSize = state.layout.snapGridSize;

        const g = computeResizeGeometry(
          {
            x: startWindowX,
            y: startWindowY,
            width: startWidth,
            height: startHeight,
          },
          direction,
          { clientX: startX, clientY: startY },
          { clientX: moveEvent.clientX, clientY: moveEvent.clientY },
          gridSize,
        );

        store.updateWindow(windowId, {
          width: g.width,
          height: g.height,
          x: g.x,
          y: g.y,
        });

        // Show snap preview for resize
        store.setSnapPreview({
          windowId,
          position: {
            x: g.x,
            y: g.y,
            width: g.width,
            height: g.height,
          },
        });
      };

      const handleMouseUp = () => {
        store.setResizingWindowId(null);
        store.setSnapPreview(null);
        globalThis.window.removeEventListener("mousemove", handleMouseMove);
        globalThis.window.removeEventListener("mouseup", handleMouseUp);
      };

      globalThis.window.addEventListener("mousemove", handleMouseMove);
      globalThis.window.addEventListener("mouseup", handleMouseUp);
    },
    [state.layout.windows, state.layout.snapGridSize, store],
  );

  // Handle window state changes
  const handleMinimize = React.useCallback(
    (windowId: string) => () => {
      store.updateWindow(windowId, { state: "minimized" });
    },
    [store],
  );

  const handleToggleMaximize = React.useCallback(
    (windowId: string) => () => {
      const win = state.layout.windows.find((w) => w.id === windowId);
      if (!win) return;
      store.updateWindow(windowId, {
        state: win.state === "maximized" ? "normal" : "maximized",
      });
    },
    [state.layout.windows, store],
  );

  const handleClose = React.useCallback(
    (windowId: string) => () => {
      store.closeWindow(windowId);
    },
    [store],
  );

  const handleFocus = React.useCallback(
    (windowId: string) => () => {
      const window = state.layout.windows.find(
        (entry) => entry.id === windowId,
      );
      if (!window) {
        return;
      }
      store.focusWindow(windowId);
      onWindowFocus?.(window);
    },
    [onWindowFocus, state.layout.windows, store],
  );

  const windowContents = React.useMemo(
    () =>
      new Map(
        state.layout.windows.map((win) => [win.id, renderWindowContent(win)]),
      ),
    [renderWindowContent, state.layout.windows],
  );

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        state.draggingWindowId && "cursor-move",
        state.resizingWindowId && "cursor-nwse-resize",
        className,
      )}
    >
      {state.layout.windows.map((win) => (
        <CanvasWindowFrame
          key={win.id}
          win={win}
          content={windowContents.get(win.id) ?? null}
          onClose={handleClose(win.id)}
          onFocus={handleFocus(win.id)}
          onMinimize={handleMinimize(win.id)}
          onToggleMaximize={handleToggleMaximize(win.id)}
          onDragStart={handleDragStart(win.id)}
          onResizeStart={handleResizeStart(win.id)}
        />
      ))}

      {/* Snap preview */}
      {state.snapPreview && (
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-dashed border-neutral-400/60 bg-neutral-200/5"
          style={{
            left: state.snapPreview.position.x,
            top: state.snapPreview.position.y,
            width: state.snapPreview.position.width,
            height: state.snapPreview.position.height,
          }}
        />
      )}
    </div>
  );
}

export interface MinimizedWindowsBarProps {
  /** Additional class name */
  className?: string;
  /** Called when a window is restored */
  onRestore?: (windowId: string) => void;
}

export function MinimizedWindowsBar({
  className,
  onRestore,
}: MinimizedWindowsBarProps) {
  const { state, store } = useWindowStore();

  const minimizedWindows = state.layout.windows.filter(
    (w) => w.state === "minimized",
  );

  if (minimizedWindows.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 right-4 flex flex-wrap gap-2",
        className,
      )}
    >
      {minimizedWindows.map((win) => (
        <button
          key={win.id}
          type="button"
          className="flex h-8 items-center gap-2 rounded border border-border bg-surface-2 px-3 text-xs shadow hover:bg-surface-3"
          onClick={() => {
            store.updateWindow(win.id, { state: "normal" });
            onRestore?.(win.id);
          }}
        >
          <span className="truncate">{win.title}</span>
        </button>
      ))}
    </div>
  );
}
