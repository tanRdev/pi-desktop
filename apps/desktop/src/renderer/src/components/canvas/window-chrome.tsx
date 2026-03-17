/**
 * Canvas window chrome - the frame around a window (title bar, resize handles).
 */

import type { CanvasWindow } from "@pidesk/shared";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from '@hugeicons/react';
import { Link01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

/**
 * Props for WindowChrome component.
 */
export interface WindowChromeProps {
  /** The window being rendered */
  window: CanvasWindow;
  /** Window content */
  children: React.ReactNode;
  /** Called when the window is closed */
  onClose?: () => void;
  /** Called when the window is focused */
  onFocus?: () => void;
  /** Called when the window is minimized */
  onMinimize?: () => void;
  /** Called when the window is maximized/restored */
  onToggleMaximize?: () => void;
  /** Called when drag starts */
  onDragStart?: (e: React.MouseEvent) => void;
  /** Called when resize starts */
  onResizeStart?: (e: React.MouseEvent, direction: ResizeDirection) => void;
  /** Additional class name */
  className?: string;
  /** Called when link button is clicked (terminal windows only) */
  onLink?: () => void;
  /** Whether this terminal is linked to the chatbox */
  isLinked?: boolean;
  /** Link color for the glow ring */
  linkedColor?: string;
}

/**
 * Resize direction for window edges.
 */
export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * Window chrome component - renders the frame around a window.
 */
export function WindowChrome({
  window,
  children,
  onClose,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onDragStart,
  onResizeStart,
  onLink,
  isLinked,
  linkedColor,
  className,
}: WindowChromeProps) {
  const isMaximized = window.state === "maximized";
  const isMinimized = window.state === "minimized";

  return (
    <div
      className={cn(
        "absolute flex flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-lg transition-shadow",
        window.isFocused && "shadow-2xl ring-2 ring-white/30 shadow-white/10",
        isLinked && linkedColor && "ring-2 shadow-lg",
        isMinimized && "opacity-50",
        className,
      )}
      style={{
        left: window.x,
        top: window.y,
        width: window.width,
        height: isMinimized ? 28 : window.height,
        zIndex: window.zIndex,
        ...(isLinked && linkedColor ? {
          outline: `2px solid ${linkedColor}80`,
          boxShadow: `0 0 0 2px ${linkedColor}40, 0 0 24px ${linkedColor}30`
        } : {})
      }}
      onMouseDown={onFocus}
      data-window-id={window.id}
      data-window-kind={window.kind}
    >
      {/* Title bar */}
      <div
        className={cn(
          "relative flex h-7 shrink-0 items-center border-b border-border px-2 select-none",
          "bg-surface-2 cursor-move",
        )}
        onMouseDown={onDragStart}
        data-drag-handle
      >
        {/* Left: traffic lights */}
        <div className="absolute left-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            title="Close"
            aria-label="Close window"
            className="h-2.5 w-2.5 rounded-full bg-red-500 hover:brightness-95 focus:outline-none"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMinimize?.(); }}
            title="Minimize"
            aria-label="Minimize window"
            className="h-2.5 w-2.5 rounded-full bg-amber-400 hover:brightness-95 focus:outline-none"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleMaximize?.(); }}
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label="Maximize or restore window"
            className="h-2.5 w-2.5 rounded-full bg-emerald-500 hover:brightness-95 focus:outline-none"
          />
        </div>

        {/* Center: title (keeps centered even when dirty) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="min-w-0 flex items-center gap-2">
            <span className="truncate text-[11px] font-medium text-foreground font-[var(--app-font-mono)]">
              {window.title}
              {"isDirty" in window && window.isDirty && (
                <span className="ml-1 text-foreground">●</span>
              )}
            </span>
          </div>
        </div>

        {/* Right: per-kind actions */}
        <div className="absolute right-3 z-10 flex items-center gap-1.5">
          {window.kind === 'terminal' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLink?.(); }}
              title={isLinked ? 'Unlink from chatbox' : 'Link to chatbox'}
              aria-label={isLinked ? 'Unlink terminal from chatbox' : 'Link terminal to chatbox'}
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus:outline-none',
                isLinked && 'text-foreground'
              )}
              style={isLinked && linkedColor ? { color: linkedColor } : undefined}
            >
              {isLinked ? <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" /> : <HugeiconsIcon icon={Link01Icon} className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* NOTE: top-right controls intentionally removed for floating windows */}

      </div>

      {/* Content area */}
      {!isMinimized && (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      )}

      {/* Resize handles (not shown when maximized or minimized) */}
      {!isMaximized && !isMinimized && (
        <>
          {/* Edges (wider hit targets for usability) */}
          <div
            className="absolute left-0 top-7 w-3 cursor-ew-resize"
            style={{ height: "calc(100% - 1.75rem)" }}
            onMouseDown={(e) => onResizeStart?.(e, "w")}
          />
          <div
            className="absolute right-0 top-7 w-3 cursor-ew-resize"
            style={{ height: "calc(100% - 1.75rem)" }}
            onMouseDown={(e) => onResizeStart?.(e, "e")}
          />
          <div
            className="absolute bottom-0 left-0 h-3 cursor-ns-resize"
            style={{ width: "100%" }}
            onMouseDown={(e) => onResizeStart?.(e, "s")}
          />
          <div
            className="absolute left-0 right-0 top-7 h-3 cursor-ns-resize"
            onMouseDown={(e) => onResizeStart?.(e, "n")}
          />

          {/* Corners (bigger targets) */}
          <div
            className="absolute bottom-0 left-0 h-4 w-4 cursor-sw-resize"
            onMouseDown={(e) => onResizeStart?.(e, "sw")}
          />
          <div
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
            onMouseDown={(e) => onResizeStart?.(e, "se")}
          />
          <div
            className="absolute left-0 top-7 h-4 w-4 cursor-nw-resize"
            onMouseDown={(e) => onResizeStart?.(e, "nw")}
          />
          <div
            className="absolute right-0 top-7 h-4 w-4 cursor-ne-resize"
            onMouseDown={(e) => onResizeStart?.(e, "ne")}
          />
        </>
      )}

    </div>
  );
}

export interface WindowMinimizedProps {
  window: CanvasWindow;
  onRestore?: () => void;
  onClose?: () => void;
}

export function WindowMinimized({ window, onRestore, onClose }: WindowMinimizedProps) {
  return (
    <div
      className="flex h-8 w-48 items-center justify-between rounded border border-border bg-surface-2 px-2 py-1 shadow"
      onDoubleClick={onRestore}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-xs text-foreground">{window.title}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-3"
      >
        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export interface WindowBackdropProps {
  visible: boolean;
  onClick?: () => void;
}

export function WindowBackdrop({ visible, onClick }: WindowBackdropProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
      onMouseDown={onClick}
    />
  );
}