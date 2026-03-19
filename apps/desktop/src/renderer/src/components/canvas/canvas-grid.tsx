import type * as React from "react";

export function getCanvasGridStyle(snapGridSize: number): React.CSSProperties {
  const safeGridSize = snapGridSize > 0 ? snapGridSize : 16;
  const offset = safeGridSize / 2;

  return {
    backgroundImage:
      "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px), radial-gradient(circle, rgba(0,0,0,0.3) 1px, transparent 1px)",
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
      className={className}
      style={getCanvasGridStyle(snapGridSize)}
      aria-hidden="true"
    />
  );
}
