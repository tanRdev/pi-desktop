import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useSplitPane } from "./use-split-pane";

type SplitDirection = "horizontal" | "vertical";

interface SplitPaneProps {
  id: string;
  direction?: SplitDirection;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  onResize?: (size: number) => void;
  children: [ReactNode, ReactNode];
  className?: string;
}

const DEFAULT_MIN_SIZE = 10;
const DEFAULT_MAX_SIZE = 90;
const DEFAULT_SIZE = 50;
const DIVIDER_SIZE_PX = 4;

function SplitPane({
  id,
  direction = "horizontal",
  defaultSize = DEFAULT_SIZE,
  minSize = DEFAULT_MIN_SIZE,
  maxSize = DEFAULT_MAX_SIZE,
  onResize,
  children,
  className,
}: SplitPaneProps) {
  const {
    size,
    isDragging,
    resetToDefault,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleKeyDown,
  } = useSplitPane({
    id,
    defaultSize,
    minSize,
    maxSize,
    direction,
    onResize,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isVertical = direction === "vertical";

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      handleDragStart();
    },
    [handleDragStart],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      handleDragMove(e.clientX, e.clientY, rect);
    },
    [isDragging, handleDragMove],
  );

  const onPointerUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const onDoubleClick = useCallback(() => {
    resetToDefault();
  }, [resetToDefault]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleKeyDown(e.key);
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Enter"
      ) {
        e.preventDefault();
      }
    },
    [handleKeyDown],
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalUp = () => handleDragEnd();
    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, [isDragging, handleDragEnd]);

  const dividerCursor = isVertical ? "cursor-row-resize" : "cursor-col-resize";

  const dividerDimension = isVertical
    ? { height: DIVIDER_SIZE_PX, width: "100%" }
    : { width: DIVIDER_SIZE_PX, height: "100%" };

  return (
    <div
      ref={containerRef}
      data-slot="split-pane"
      data-direction={direction}
      className={cn(
        "flex min-h-0 min-w-0 overflow-hidden",
        isVertical ? "flex-col" : "flex-row",
        isDragging && "select-none",
        className,
      )}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
        aria-orientation={direction}
        aria-valuenow={Math.round(size)}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        className={cn(
          "shrink-0 outline-none transition-colors duration-150",
          "hover:bg-[var(--glass-border-active,rgba(255,255,255,0.15))]",
          "focus-visible:ring-2 focus-visible:ring-[var(--color-accent-ring)]",
          dividerCursor,
        )}
        style={dividerDimension}
      />

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
export type { SplitPaneProps, SplitDirection };
