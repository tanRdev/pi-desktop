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
  onTitleChange?: (newTitle: string) => void;
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
  onTitleChange,
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
      onTitleChange={onTitleChange}
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

  const handleTitleChange = React.useCallback(
    (windowId: string) => (newTitle: string) => {
      store.updateWindow(windowId, { title: newTitle });
    },
    [store],
  );

  const windowContents = React.useMemo(
    () =>
      new Map(
        state.layout.windows.map((win) => [win.id, renderWindowContent(win)]),
      ),
    [renderWindowContent, state.layout.windows],
  );

  // Handle wheel zoom (Ctrl/Cmd + wheel)
  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        store.setZoom(state.layout.zoom + delta);
      }
    },
    [state.layout.zoom, store],
  );

  // Handle canvas pan (middle mouse drag or space+drag)
  const [isPanning, setIsPanning] = React.useState(false);
  const panStartRef = React.useRef({ x: 0, y: 0 });

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      // Middle mouse button or space key held starts panning
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX - state.layout.panX,
          y: e.clientY - state.layout.panY,
        };
      }
    },
    [state.layout.panX, state.layout.panY],
  );

  React.useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      store.setPan(
        e.clientX - panStartRef.current.x,
        e.clientY - panStartRef.current.y,
      );
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning, store]);

  const zoom = state.layout.zoom;
  const panX = state.layout.panX;
  const panY = state.layout.panY;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        state.draggingWindowId && "cursor-move",
        state.resizingWindowId && "cursor-nwse-resize",
        isPanning && "cursor-grabbing",
        className,
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
    >
      {/* Canvas transform layer */}
      <div
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        }}
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
            onTitleChange={handleTitleChange(win.id)}
            onDragStart={handleDragStart(win.id)}
            onResizeStart={handleResizeStart(win.id)}
          />
        ))}

        {/* Snap preview */}
        {state.snapPreview && (
          <div
            className={cn(
              "pointer-events-none absolute rounded-lg border-2 border-dashed border-neutral-400/60 bg-neutral-200/5",
              "transition-[transform,opacity] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-100 motion-reduce:ease-out motion-reduce:transition-opacity",
              "origin-center",
              "scale-[0.98] opacity-95",
            )}
            style={{
              left: state.snapPreview.position.x,
              top: state.snapPreview.position.y,
              width: state.snapPreview.position.width,
              height: state.snapPreview.position.height,
              "--ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
            } as React.CSSProperties}
          />
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-border bg-surface-1/90 p-1 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={() => store.zoomOut()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Zoom out"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => store.resetZoom()}
          className="min-w-[3rem] px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => store.zoomIn()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Zoom in"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
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
      {minimizedWindows.map((win, index) => (
        <button
          key={win.id}
          type="button"
          className={cn(
            "flex h-8 items-center gap-2 rounded border border-border bg-surface-2 px-3 text-xs shadow",
            "transition-all duration-[250ms] motion-reduce:duration-150",
            "ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:ease-out",
            "hover:bg-surface-3 hover:shadow-md hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
            "active:scale-[0.97] motion-reduce:active:scale-95 active:translate-y-0",
            "origin-bottom",
            "motion-reduce:[animation:none]",
            "animate-in fade-in slide-in-from-bottom-2",
            "opacity-0 [animation-fill-mode:forwards]",
          )}
          style={{
            animationDelay: `${index * 40}ms`,
            animationDuration: "250ms",
            "--ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
          } as React.CSSProperties}
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
