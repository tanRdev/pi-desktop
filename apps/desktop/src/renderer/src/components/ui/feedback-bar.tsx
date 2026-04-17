import { Copy } from "@phosphor-icons/react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        <span className="text-[10px] text-white/30 font-mono">{duration}</span>
      )}
      {onCopy ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={onCopy}
          aria-label="Copy response"
          className="text-white/20 hover:text-white/50 hover:bg-transparent"
        >
          <Copy className="size-3" />
        </Button>
      ) : null}
    </div>
  );
}

// Keep for backward compatibility - deprecated
export type FeedbackValue = "up" | "down" | null;
