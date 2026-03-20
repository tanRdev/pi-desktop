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
  const [isHovered, setIsHovered] = React.useState(false);
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
        "shell-window absolute flex flex-col overflow-hidden border bg-surface-1",
        "transition-[border-color,box-shadow,transform,opacity] duration-[250ms]",
        "ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-150 motion-reduce:ease-out",
        "motion-reduce:transition-colors",
        "origin-top",
        window.isFocused && "border-border-hover shadow-lg",
        !window.isFocused && "border-border-subtle",
        isMinimized && "opacity-50 scale-[0.98]",
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="presentation"
      data-window-id={window.id}
      data-window-kind={window.kind}
      data-focus-state={window.isFocused ? "active" : "inactive"}
    >
      {/* Title bar */}
      <div
        className={cn(
          "shell-titlebar relative flex h-9 shrink-0 items-center border-b border-border-subtle px-3 select-none cursor-move",
          "transition-colors duration-150",
          window.isFocused && "bg-surface-2",
          !window.isFocused && "bg-surface-1",
        )}
        onMouseDown={onDragStart}
        role="presentation"
        data-drag-handle
      >
        {/* Left: traffic lights (Mac-style) with enhanced interactions */}
        <div className="absolute left-3 z-10 flex items-center gap-2 group">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            title="Close"
            aria-label="Close window"
            data-control="close"
            className={cn(
              "shell-control-dot flex h-4 w-4 items-center justify-center rounded-full",
              "transition-all duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60",
              "hover:scale-110 motion-reduce:hover:scale-100",
              "active:scale-[0.95] motion-reduce:active:scale-95",
              "will-change-transform",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-2 w-2 opacity-0 transition-opacity group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMinimize?.();
            }}
            title="Minimize"
            aria-label="Minimize window"
            data-control="minimize"
            className={cn(
              "shell-control-dot flex h-4 w-4 items-center justify-center rounded-full",
              "transition-all duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60",
              "hover:scale-110 motion-reduce:hover:scale-100",
              "active:scale-[0.95] motion-reduce:active:scale-95",
              "will-change-transform",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-2 w-2 opacity-0 transition-opacity group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMaximize?.();
            }}
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label="Maximize or restore window"
            data-control="maximize"
            className={cn(
              "shell-control-dot flex h-4 w-4 items-center justify-center rounded-full",
              "transition-all duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60",
              "hover:scale-110 motion-reduce:hover:scale-100",
              "active:scale-[0.95] motion-reduce:active:scale-95",
              "will-change-transform",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-2 w-2 opacity-0 transition-opacity group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              {isMaximized ? (
                <>
                  <rect x="4" y="8" width="12" height="12" rx="1" />
                  <path d="M8 4h12v12" />
                </>
              ) : (
                <rect x="4" y="4" width="16" height="16" rx="1" />
              )}
            </svg>
          </button>
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
                className={cn(
                  "pointer-events-auto w-full min-w-[60px] max-w-[200px] truncate rounded-sm",
                  "border border-border-subtle bg-surface-2 px-1.5 py-0.5",
                  "text-xs font-normal tracking-normal text-foreground outline-none",
                  "focus:border-ring/60 transition-colors duration-150",
                )}
                data-no-drag
              />
            ) : (
              <span
                className={cn(
                  "truncate text-xs font-normal tracking-normal pointer-events-auto cursor-default",
                  "transition-colors duration-150",
                  window.isFocused ? "text-foreground" : "text-muted-foreground",
                )}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
              >
                {window.title}
                {"isDirty" in window && window.isDirty && (
                  <span className="ml-1 text-foreground animate-pulse">●</span>
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
            className={cn(
              "absolute left-0 top-10 w-3 cursor-ew-resize",
              "transition-[background-color,transform] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "hover:bg-ring/5 hover:scale-x-110 motion-reduce:hover:scale-x-100",
            )}
            style={{ height: "calc(100% - 2.5rem)" }}
            onMouseDown={(e) => onResizeStart?.(e, "w")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute right-0 top-10 w-3 cursor-ew-resize",
              "transition-[background-color,transform] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "hover:bg-ring/5 hover:scale-x-110 motion-reduce:hover:scale-x-100",
            )}
            style={{ height: "calc(100% - 2.5rem)" }}
            onMouseDown={(e) => onResizeStart?.(e, "e")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute bottom-0 left-0 h-3 cursor-ns-resize",
              "transition-[background-color,transform] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "hover:bg-ring/5 hover:scale-y-110 motion-reduce:hover:scale-y-100",
            )}
            style={{ width: "100%" }}
            onMouseDown={(e) => onResizeStart?.(e, "s")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute left-0 right-0 top-10 h-3 cursor-ns-resize",
              "transition-[background-color,transform] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "hover:bg-ring/5 hover:scale-y-110 motion-reduce:hover:scale-y-100",
            )}
            onMouseDown={(e) => onResizeStart?.(e, "n")}
            role="presentation"
            aria-hidden="true"
          />

          {/* Corners (bigger targets) */}
          <div
            className={cn(
              "absolute bottom-0 left-0 h-4 w-4 cursor-sw-resize",
              "transition-[background-color,transform] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "hover:bg-ring/5 hover:scale-125 motion-reduce:hover:scale-100",
            )}
            onMouseDown={(e) => onResizeStart?.(e, "sw")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute bottom-0 right-0 h-4 w-4 cursor-se-resize",
              "transition-[background-color,transform] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "hover:bg-ring/5 hover:scale-125 motion-reduce:hover:scale-100",
            )}
            onMouseDown={(e) => onResizeStart?.(e, "se")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute left-0 top-10 h-4 w-4 cursor-nw-resize",
              "transition-[background-color,transform] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "hover:bg-ring/5 hover:scale-125 motion-reduce:hover:scale-100",
            )}
            onMouseDown={(e) => onResizeStart?.(e, "nw")}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute right-0 top-10 h-4 w-4 cursor-ne-resize",
              "transition-[background-color,transform] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:duration-150 motion-reduce:ease-out",
              "hover:bg-ring/5 hover:scale-125 motion-reduce:hover:scale-100",
            )}
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
      className={cn(
        "flex h-8 w-48 items-center justify-between rounded-sm border border-border-subtle bg-surface-1 px-2 py-1",
        "transition-all duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        "motion-reduce:duration-150 motion-reduce:ease-out",
        "hover:border-border-hover hover:shadow-sm",
        "motion-reduce:hover:shadow-none",
      )}
      onDoubleClick={onRestore}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-xs text-foreground">{window.title}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-sm",
          "transition-all duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          "motion-reduce:duration-150 motion-reduce:ease-out",
          "hover:bg-surface-2 hover:scale-110 motion-reduce:hover:scale-100",
          "active:scale-[0.95] motion-reduce:active:scale-95",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60",
        )}
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
      className={cn(
        "shell-backdrop fixed inset-0 z-40",
        "transition-opacity duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        "motion-reduce:duration-150 motion-reduce:ease-out",
        "motion-reduce:transition-none",
      )}
      onMouseDown={onClick}
      role="presentation"
      aria-hidden="true"
    />
  );
}
