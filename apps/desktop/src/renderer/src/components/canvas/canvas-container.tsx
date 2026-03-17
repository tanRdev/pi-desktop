/**
 * Canvas container - manages all windows on the canvas.
 */

import type { CanvasWindow } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useWindowStore } from "../../hooks/use-window-store";
import { type ResizeDirection, WindowChrome } from "./window-chrome";

/**
 * Props for CanvasContainer component.
 */
export interface CanvasContainerProps {
  /** Render content for a specific window */
  renderWindowContent: (window: CanvasWindow) => React.ReactNode;
  /** Called after a window receives focus */
  onWindowFocus?: (window: CanvasWindow) => void;
  /** ID of the terminal window currently linked to the chatbox */
  linkedTerminalWindowId?: string | null;
  /** Called when a terminal link button is toggled */
  onLinkTerminal?: (windowId: string | null) => void;
  /** Additional class name */
  className?: string;
}

/**
 * Canvas container component - renders all windows on a canvas.
 */
export function CanvasContainer({
  renderWindowContent,
  onWindowFocus,
  linkedTerminalWindowId,
  onLinkTerminal,
  className,
}: CanvasContainerProps) {
  const { state, store } = useWindowStore();
  const [draggingWindowId, setDraggingWindowId] = React.useState<string | null>(null);
  const [resizingWindowId, setResizingWindowId] = React.useState<string | null>(null);

  // Pan & zoom state
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = React.useState<number>(0.85);
  const [panX, setPanX] = React.useState<number>(0);
  const [panY, setPanY] = React.useState<number>(0);
  const zoomRef = React.useRef(zoom);
  const panXRef = React.useRef(panX);
  const panYRef = React.useRef(panY);
  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  React.useEffect(() => { panXRef.current = panX; }, [panX]);
  React.useEffect(() => { panYRef.current = panY; }, [panY]);

  // Wheel handler: ctrl/meta + wheel = zoom, otherwise pan. Use addEventListener with passive:false.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      // Zoom when Ctrl (or Meta) is pressed (pinch gesture on some trackpads)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const deltaY = e.deltaY;
        const currentZoom = zoomRef.current;
        let newZoom = currentZoom * (1 + deltaY * -0.001);
        const minZoom = 0.05;
        const maxZoom = Math.max(2, 1 + state.layout.windows.length * 0.5);
        newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
        setZoom(newZoom);
        return;
      }
      // Pan otherwise
      e.preventDefault();
      const dx = e.deltaX;
      const dy = e.deltaY;
      const currentZoom = zoomRef.current || 1;
      // Divide pan deltas by zoom so panning feels consistent across zoom levels
      setPanX((prev) => prev - dx / currentZoom);
      setPanY((prev) => prev - dy / currentZoom);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [state.layout.windows.length]);

  // Handle drag
  const handleDragStart = React.useCallback(
    (windowId: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      setDraggingWindowId(windowId);

      const startX = e.clientX;
      const startY = e.clientY;
      const win = state.layout.windows.find((w) => w.id === windowId);
      if (!win) return;

      const startWindowX = win.x;
      const startWindowY = win.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / zoomRef.current;
        const dy = (moveEvent.clientY - startY) / zoomRef.current;
        const gridSize = state.layout.snapGridSize;

        const newX = Math.round((startWindowX + dx) / gridSize) * gridSize;
        const newY = Math.round((startWindowY + dy) / gridSize) * gridSize;

        // Move the actual window while also showing snap preview
        store.moveWindow(windowId, newX, newY);
        store.setSnapPreview({ windowId, position: { x: newX, y: newY, width: win.width, height: win.height } });
      };

      const handleMouseUp = () => {
        setDraggingWindowId(null);
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
      setResizingWindowId(windowId);

      const startX = e.clientX;
      const startY = e.clientY;
      const win = state.layout.windows.find((w) => w.id === windowId);
      if (!win) return;

      const startWidth = win.width;
      const startHeight = win.height;
      const startWindowX = win.x;
      const startWindowY = win.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / zoomRef.current;
        const dy = (moveEvent.clientY - startY) / zoomRef.current;
        const gridSize = state.layout.snapGridSize;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startWindowX;
        let newY = startWindowY;

        // Apply delta based on direction
        if (direction.includes("e")) newWidth += dx;
        if (direction.includes("w")) {
          newWidth -= dx;
          newX += dx;
        }
        if (direction.includes("s")) newHeight += dy;
        if (direction.includes("n")) {
          newHeight -= dy;
          newY += dy;
        }

        // Minimum size constraints
        const minWidth = 300;
        const minHeight = 200;
        newWidth = Math.max(minWidth, newWidth);
        newHeight = Math.max(minHeight, newHeight);

        // Snap to grid
        const snappedWidth = Math.round(newWidth / gridSize) * gridSize;
        const snappedHeight = Math.round(newHeight / gridSize) * gridSize;
        const snappedX = Math.round(newX / gridSize) * gridSize;
        const snappedY = Math.round(newY / gridSize) * gridSize;

        store.updateWindow(windowId, {
          width: snappedWidth,
          height: snappedHeight,
          x: direction.includes("w") ? snappedX : win.x,
          y: direction.includes("n") ? snappedY : win.y,
        });
        // Show snap preview for resize
        store.setSnapPreview({
          windowId,
          position: {
            x: direction.includes("w") ? snappedX : win.x,
            y: direction.includes("n") ? snappedY : win.y,
            width: snappedWidth,
            height: snappedHeight,
          },
        });
      };

      const handleMouseUp = () => {
        setResizingWindowId(null);
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
      const window = state.layout.windows.find((entry) => entry.id === windowId);
      if (!window) {
        return;
      }
      store.focusWindow(windowId);
      onWindowFocus?.(window);
    },
    [onWindowFocus, state.layout.windows, store],
  );

  // Background mousedown: blur focused window OR start drag-to-pan when nothing is focused.
  const handleBackgroundMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      // Ignore clicks that originated inside a canvas window.
      if ((e.target as Element).closest('[data-window-id]')) return;

      if (state.layout.focusedWindowId !== null) {
        // A window is focused — clicking the background unfocuses it.
        store.blurAll();
        return;
      }

      // No focused window — start free drag-to-pan.
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPanX = panXRef.current;
      const startPanY = panYRef.current;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        setPanX(startPanX + (moveEvent.clientX - startX));
        setPanY(startPanY + (moveEvent.clientY - startY));
      };

      const handleMouseUp = () => {
        globalThis.window.removeEventListener('mousemove', handleMouseMove);
        globalThis.window.removeEventListener('mouseup', handleMouseUp);
      };

      globalThis.window.addEventListener('mousemove', handleMouseMove);
      globalThis.window.addEventListener('mouseup', handleMouseUp);
    },
    [panXRef, panYRef, state.layout.focusedWindowId, store],
  );


  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden select-none",
        draggingWindowId && "cursor-move",
        resizingWindowId && "cursor-nwse-resize",
        !draggingWindowId && !resizingWindowId && !state.layout.focusedWindowId && "cursor-grab",
        className,
      )}
      onMouseDown={handleBackgroundMouseDown}
    >
      <div
        className="relative w-full h-full"
        style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: "0 0" }}
      >
        {state.layout.windows.map((win) => (
          <WindowChrome
            key={win.id}
            window={win}
            onClose={handleClose(win.id)}
            onFocus={handleFocus(win.id)}
            onMinimize={handleMinimize(win.id)}
            onToggleMaximize={handleToggleMaximize(win.id)}
            onDragStart={handleDragStart(win.id)}
            onResizeStart={handleResizeStart(win.id)}
            isLinked={linkedTerminalWindowId === win.id}
            linkedColor="#06b6d4"
            onLink={() => {
              onLinkTerminal?.(linkedTerminalWindowId === win.id ? null : win.id);
            }}
          >
            {renderWindowContent(win)}
          </WindowChrome>
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

  const minimizedWindows = state.layout.windows.filter((w) => w.state === "minimized");

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