"use client";

import { cn } from "@pi-desktop/ui";
import type * as React from "react";

export type TextShimmerProps = {
  as?: React.ElementType;
  duration?: number;
  spread?: number;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

export function TextShimmer({
  as: Component = "span",
  className,
  duration = 4,
  spread = 20,
  children,
  ...props
}: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45);

  return (
    <Component
      className={cn(
        "bg-size-[200%_auto] bg-clip-text font-normal text-transparent",
        "animate-[shimmer_4s_infinite_linear]",
        "transition-all duration-150 ease-out",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.4) ${50 - dynamicSpread}%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.4) ${50 + dynamicSpread}%)`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
