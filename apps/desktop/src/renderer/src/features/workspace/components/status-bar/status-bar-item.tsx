import type * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface StatusBarItemProps {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  tooltip?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}

/**
 * Compact, optionally clickable status bar cell with icon + label and a
 * tooltip. Renders as a button only when an `onClick` handler is provided
 * so non-interactive cells stay out of the tab order.
 */
export function StatusBarItem({
  icon,
  label,
  tooltip,
  onClick,
  ariaLabel,
  className,
  testId,
}: StatusBarItemProps) {
  const baseClass = cn(
    "flex h-full items-center gap-1.5 px-2 text-[11px] leading-none text-white/55",
    "transition-colors duration-150 motion-reduce:transition-none",
    className,
  );

  const interactiveClass = cn(
    "hover:bg-white/[0.06] hover:text-white/80 active:bg-white/[0.06]",
    "focus-visible:outline-none focus-visible:bg-white/[0.06] focus-visible:text-white/90",
  );

  const content = (
    <>
      {icon ? (
        <span className="flex shrink-0 items-center text-white/45">{icon}</span>
      ) : null}
      {label ? <span className="truncate">{label}</span> : null}
    </>
  );

  const node = onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(baseClass, interactiveClass)}
    >
      {content}
    </button>
  ) : (
    <span data-testid={testId} title={ariaLabel} className={baseClass}>
      {content}
    </span>
  );

  if (!tooltip) {
    return node;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
