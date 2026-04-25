import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@pi-desktop/ui";
import * as React from "react";
import type { IndicatorState } from "./left-sidebar-tree-types";

export function StatusIndicator({ state }: { state: IndicatorState }) {
  if (state === "streaming") {
    return (
      <span aria-hidden="true" className="relative size-2 shrink-0">
        <span className="absolute inset-0 size-full bg-[var(--color-accent)]/70" />
        <span className="absolute inset-0 size-full bg-[var(--color-accent)]/40 animate-indicator-pulse" />
      </span>
    );
  }

  if (state === "unread") {
    return (
      <span
        aria-hidden="true"
        className="size-2 shrink-0 bg-[var(--color-secondary-accent)]/80"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 border border-white/20"
    />
  );
}

export function TreeConnector({
  count,
  rowHeight,
  startY,
  indent,
}: {
  count: number;
  rowHeight: number;
  startY: number;
  indent: number;
}) {
  if (count === 0) return null;

  const lastBranchY = startY + (count - 1) * rowHeight;

  return (
    <svg
      className="absolute pointer-events-none"
      aria-hidden="true"
      style={{
        left: 0,
        top: 0,
        width: indent + 6,
        height: lastBranchY + 1,
        overflow: "visible",
      }}
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={lastBranchY}
        stroke="rgba(255, 255, 255, 0.06)"
        strokeWidth={1}
      />

      {Array.from({ length: count }).map((_, i) => {
        const y = startY + i * rowHeight;
        return (
          <g key={i}>
            <line
              x1={0}
              y1={y}
              x2={indent - 2}
              y2={y}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth={1}
            />
            <line
              x1={indent - 2}
              y1={y}
              x2={indent + 4}
              y2={y}
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function SidebarEdgeToggle({
  label,
  side,
  onClick,
  onResizeDragStart,
}: {
  label: string;
  side: "left" | "right";
  onClick: () => void;
  onResizeDragStart?: (e: React.MouseEvent) => void;
}) {
  const Icon = side === "right" ? CaretLeft : CaretRight;
  const didDragRef = React.useRef(false);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (!onResizeDragStart) return;
      didDragRef.current = false;
      const startX = e.clientX;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (Math.abs(moveEvent.clientX - startX) > 3) {
          didDragRef.current = true;
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener(
        "mouseup",
        () => document.removeEventListener("mousemove", handleMouseMove),
        { once: true },
      );

      onResizeDragStart(e);
    },
    [onResizeDragStart],
  );

  return (
    <div
      className={cn(
        "group absolute inset-y-0 z-30 flex w-4 items-center justify-center",
        side === "right" ? "right-0 translate-x-1/2" : "left-1",
        onResizeDragStart && "cursor-ew-resize",
      )}
      onMouseDown={handleMouseDown}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={() => {
              if (!didDragRef.current) {
                onClick();
              }
            }}
            className={cn(
              "flex h-8 w-3 touch-manipulation items-center justify-center",
              "bg-[var(--color-bg-primary)] text-white/50",
              "border border-white/[0.10]",
              "opacity-0 group-hover:opacity-100",
              "transition-all duration-150 hover:text-white hover:border-white/30 hover:shadow-[0_0_8px_2px_rgba(255,255,255,0.08)]",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
              side === "right" ? "rounded-r-md" : "rounded-l-md",
            )}
          >
            <Icon aria-hidden="true" className="size-2" weight="bold" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side === "right" ? "left" : "right"}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
