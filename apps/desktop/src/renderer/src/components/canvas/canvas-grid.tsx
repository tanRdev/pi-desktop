import type * as React from "react";
import { cn } from "@/lib/utils";

export function getCanvasGridStyle(snapGridSize: number): React.CSSProperties {
  const safeGridSize = snapGridSize > 0 ? snapGridSize : 16;
  const offset = safeGridSize / 2;

  return {
    backgroundImage:
      "radial-gradient(circle, rgba(255,255,255,0.1) 0.5px, transparent 0.5px)",
    backgroundSize: `${safeGridSize}px ${safeGridSize}px`,
    backgroundPosition: `0 0, ${offset}px ${offset}px`,
  };
}

export function CanvasGrid({
  snapGridSize,
  className,
}: {
  snapGridSize: number;
  className?: string;
}) {
  return (
    <div
      data-testid="canvas-grid"
      className={cn(
        "transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "motion-reduce:duration-150 motion-reduce:ease-out motion-reduce:transition-none",
        className,
      )}
      style={
        {
          ...getCanvasGridStyle(snapGridSize),
          "--ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
        } as React.CSSProperties
      }
      aria-hidden="true"
    />
  );
}
