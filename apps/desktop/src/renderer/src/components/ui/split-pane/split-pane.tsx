import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_MIN_SIZE = 10;
const DEFAULT_MAX_SIZE = 90;
const DEFAULT_SIZE = 50;
const KEYBOARD_STEP = 1;
const KEYBOARD_STEP_SHIFT = 10;
const COLLAPSED_SIZE = 0;
const DIVIDER_HIT_AREA_PX = 8;

type SplitOrientation = "horizontal" | "vertical";

interface SplitPaneProps {
  orientation?: SplitOrientation;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  persistenceKey?: string;
  onResize?: (size: number) => void;
  children: [React.ReactNode, React.ReactNode];
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadPersistedSize(key: string | undefined): number | undefined {
  if (!key) return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return undefined;
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function persistSize(key: string | undefined, size: number): void {
  if (!key) return;
  try {
    localStorage.setItem(key, String(size));
  } catch {
    // localStorage may be unavailable (SSR, quota)
  }
}

function SplitPane({
  orientation = "horizontal",
  defaultSize = DEFAULT_SIZE,
  minSize = DEFAULT_MIN_SIZE,
  maxSize = DEFAULT_MAX_SIZE,
  persistenceKey,
  onResize,
  children,
  className,
}: SplitPaneProps) {
  const clampedDefault = clamp(defaultSize, minSize, maxSize);
  const persisted = loadPersistedSize(persistenceKey);
  const [size, setSize] = useState(
    persisted != null ? clamp(persisted, minSize, maxSize) : clampedDefault,
  );
  const [isResizing, setIsResizing] = useState(false);
  const [isDividerHovered, setIsDividerHovered] = useState(false);
  const [_isCollapsed, setIsCollapsed] = useState(false);
  const isCollapsedRef = useRef(false);
  const sizeBeforeCollapse = useRef<number>(size);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVertical = orientation === "vertical";

  const updateSize = useCallback(
    (next: number, allowCollapse = false) => {
      const effectiveMin = allowCollapse ? 0 : minSize;
      const clamped = clamp(next, effectiveMin, maxSize);
      setSize(clamped);
      onResize?.(clamped);
      persistSize(persistenceKey, clamped);
    },
    [minSize, maxSize, onResize, persistenceKey],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsResizing(true);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizing || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const total = isVertical ? rect.height : rect.width;
      if (total <= 0) return;
      const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;
      const percent = (offset / total) * 100;
      updateSize(percent);
    },
    [isResizing, isVertical, updateSize],
  );

  const handlePointerUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (isCollapsedRef.current) {
      updateSize(sizeBeforeCollapse.current, true);
      isCollapsedRef.current = false;
      setIsCollapsed(false);
    } else {
      sizeBeforeCollapse.current = size;
      updateSize(COLLAPSED_SIZE, true);
      isCollapsedRef.current = true;
      setIsCollapsed(true);
    }
  }, [size, updateSize]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? KEYBOARD_STEP_SHIFT : KEYBOARD_STEP;
      let delta = 0;
      if (!isVertical) {
        if (e.key === "ArrowLeft") delta = -step;
        if (e.key === "ArrowRight") delta = step;
      } else {
        if (e.key === "ArrowUp") delta = -step;
        if (e.key === "ArrowDown") delta = step;
      }
      if (delta !== 0) {
        e.preventDefault();
        const next = isCollapsedRef.current
          ? sizeBeforeCollapse.current + delta
          : size + delta;
        if (isCollapsedRef.current) {
          isCollapsedRef.current = false;
          setIsCollapsed(false);
        }
        updateSize(next, isCollapsedRef.current);
      }
    },
    [isVertical, size, updateSize],
  );

  useEffect(() => {
    const clamped = clamp(size, minSize, maxSize);
    if (clamped !== size) {
      setSize(clamped);
    }
  }, [minSize, maxSize, size]);

  useEffect(() => {
    if (size <= 0 && !isCollapsedRef.current) {
      isCollapsedRef.current = true;
      setIsCollapsed(true);
    } else if (size > 0 && isCollapsedRef.current) {
      isCollapsedRef.current = false;
      setIsCollapsed(false);
    }
  }, [size]);

  const dividerAccent =
    isResizing || isDividerHovered
      ? "bg-[var(--color-accent)]"
      : "bg-[var(--glass-border-default)]";

  const hitAreaStyle: React.CSSProperties = isVertical
    ? {
        position: "absolute",
        left: 0,
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        height: DIVIDER_HIT_AREA_PX,
      }
    : {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: DIVIDER_HIT_AREA_PX,
      };

  const lineStyle: React.CSSProperties = isVertical
    ? {
        position: "absolute",
        left: 0,
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        height: 1,
      }
    : {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 1,
      };

  return (
    <div
      ref={containerRef}
      data-slot="split-pane"
      data-orientation={orientation}
      className={cn(
        "flex min-h-0 min-w-0 overflow-hidden",
        isVertical ? "flex-col" : "flex-row",
        isResizing && "select-none",
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        data-slot="split-pane-primary"
        className="min-h-0 min-w-0 overflow-hidden"
        style={{
          flexBasis: `${size}%`,
          flexGrow: 0,
          flexShrink: 0,
          resize: "none",
        }}
      >
        {children[0]}
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: custom interactive separator needs div semantics for pointer/drag handlers */}
      <div
        role="separator"
        aria-orientation={orientation}
        aria-valuenow={Math.round(size)}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onPointerEnter={() => setIsDividerHovered(true)}
        onPointerLeave={() => setIsDividerHovered(false)}
        className={cn(
          "group relative shrink-0",
          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-ring)] focus-visible:ring-offset-0",
          isVertical
            ? "cursor-row-resize h-[1px] w-full"
            : "cursor-col-resize w-[1px] h-full",
          "transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] motion-reduce:transition-none",
        )}
      >
        <div style={hitAreaStyle} className="pointer-events-auto" />
        <div
          style={lineStyle}
          className={cn(
            dividerAccent,
            "transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] motion-reduce:transition-none",
          )}
        />
      </div>

      <div
        data-slot="split-pane-secondary"
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
        style={{ resize: "none" }}
      >
        {children[1]}
      </div>
    </div>
  );
}

export { SplitPane };
export type { SplitPaneProps, SplitOrientation };
