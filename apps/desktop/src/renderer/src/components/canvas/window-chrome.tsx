/**
 * Canvas window chrome - the frame around a window (title bar, resize handles).
 */

import type { CanvasWindow } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";

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
  /** Called when the window title is renamed */
  onTitleChange?: (newTitle: string) => void;
  /** Additional class name */
  className?: string;
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
  onTitleChange,
  className,
}: WindowChromeProps) {
  const isMaximized = window.state === "maximized";
  const isMinimized = window.state === "minimized";

  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editValue, setEditValue] = React.useState(window.title);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEditing = React.useCallback(() => {
    setEditValue(window.title);
    setIsEditingTitle(true);
  }, [window.title]);

  const commitEdit = React.useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== window.title) {
      onTitleChange?.(trimmed);
    }
    setIsEditingTitle(false);
  }, [editValue, window.title, onTitleChange]);

  const cancelEdit = React.useCallback(() => {
    setEditValue(window.title);
    setIsEditingTitle(false);
  }, [window.title]);

  React.useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  return (
    <div
      className={cn(
        "shell-window absolute flex flex-col overflow-hidden border border-border-subtle bg-surface-1 transition-colors duration-150",
        window.isFocused && "border-border-hover",
        isMinimized && "opacity-50",
        className,
      )}
      style={{
        left: window.x,
        top: window.y,
        width: window.width,
        height: isMinimized ? 40 : window.height,
        zIndex: window.zIndex,
      }}
      onMouseDown={onFocus}
      role="presentation"
      data-window-id={window.id}
      data-window-kind={window.kind}
      data-focus-state={window.isFocused ? "active" : "inactive"}
    >
      {/* Title bar */}
      <div
        className={cn(
          "shell-titlebar relative flex h-9 shrink-0 items-center border-b border-border-subtle px-3 select-none cursor-move",
        )}
        onMouseDown={onDragStart}
        role="presentation"
        data-drag-handle
      >
        {/* Left: traffic lights (Mac-style) */}
        <div className="absolute left-3 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            title="Close"
            aria-label="Close window"
            data-control="close"
            className="shell-control-dot h-3 w-3 rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMinimize?.();
            }}
            title="Minimize"
            aria-label="Minimize window"
            data-control="minimize"
            className="shell-control-dot h-3 w-3 rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMaximize?.();
            }}
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label="Maximize or restore window"
            data-control="maximize"
            className="shell-control-dot h-3 w-3 rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
          />
        </div>

        {/* Center: title (keeps centered even when dirty) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="min-w-0 flex items-center gap-2">
            {isEditingTitle ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitEdit();
                  } else if (e.key === "Escape") {
                    cancelEdit();
                  }
                }}
                onBlur={commitEdit}
                className="pointer-events-auto w-full min-w-[60px] max-w-[200px] truncate rounded-sm border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-xs font-normal tracking-normal text-foreground outline-none focus:border-ring/60"
                data-no-drag
              />
            ) : (
              <span
                className="truncate text-xs font-normal tracking-normal text-muted-foreground pointer-events-auto cursor-default"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
              >
                {window.title}
                {"isDirty" in window && window.isDirty && (
                  <span className="ml-1 text-foreground">●</span>
                )}
              </span>
            )}
          </div>
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
            className="absolute left-0 top-10 w-3 cursor-ew-resize"
            style={{ height: "calc(100% - 2.5rem)" }}
            onMouseDown={(e) => onResizeStart?.(e, "w")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-10 w-3 cursor-ew-resize"
            style={{ height: "calc(100% - 2.5rem)" }}
            onMouseDown={(e) => onResizeStart?.(e, "e")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 h-3 cursor-ns-resize"
            style={{ width: "100%" }}
            onMouseDown={(e) => onResizeStart?.(e, "s")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="absolute left-0 right-0 top-10 h-3 cursor-ns-resize"
            onMouseDown={(e) => onResizeStart?.(e, "n")}
            role="presentation"
            aria-hidden="true"
          />

          {/* Corners (bigger targets) */}
          <div
            className="absolute bottom-0 left-0 h-4 w-4 cursor-sw-resize"
            onMouseDown={(e) => onResizeStart?.(e, "sw")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
            onMouseDown={(e) => onResizeStart?.(e, "se")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="absolute left-0 top-10 h-4 w-4 cursor-nw-resize"
            onMouseDown={(e) => onResizeStart?.(e, "nw")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-10 h-4 w-4 cursor-ne-resize"
            onMouseDown={(e) => onResizeStart?.(e, "ne")}
            role="presentation"
            aria-hidden="true"
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

export function WindowMinimized({
  window,
  onRestore,
  onClose,
}: WindowMinimizedProps) {
  return (
    <div
      className="flex h-8 w-48 items-center justify-between rounded-sm border border-border-subtle bg-surface-1 px-2 py-1"
      onDoubleClick={onRestore}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-xs text-foreground">{window.title}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-5 w-5 items-center justify-center rounded-sm hover:bg-surface-2"
      >
        <svg
          className="h-3 w-3 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
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
      className="shell-backdrop fixed inset-0 z-40"
      onMouseDown={onClick}
      role="presentation"
      aria-hidden="true"
    />
  );
}
