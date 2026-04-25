import { Copy } from "@phosphor-icons/react";
import { Button, cn } from "@pi-desktop/ui";
import type * as React from "react";

export interface FeedbackBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onCopy?: () => void;
  duration?: string;
}

export function FeedbackBar({
  onCopy,
  duration,
  className,
  ...props
}: FeedbackBarProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 pt-1.5", className)}
      {...props}
    >
      {duration && (
        <span className="text-[11px] text-white/50 font-mono">{duration}</span>
      )}
      {onCopy ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={onCopy}
          aria-label="Copy response"
          className="text-white/45 hover:text-white/50 hover:bg-transparent"
        >
          <Copy className="size-3" />
        </Button>
      ) : null}
    </div>
  );
}

// Keep for backward compatibility - deprecated
export type FeedbackValue = "up" | "down" | null;
