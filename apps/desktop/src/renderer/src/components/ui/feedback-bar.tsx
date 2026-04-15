import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowCounterClockwise,
  Copy,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type FeedbackValue = "up" | "down" | null;

export interface FeedbackBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: FeedbackValue;
  onValueChange?: (value: FeedbackValue) => void;
  onCopy?: () => void;
  onRetry?: () => void;
}

export function FeedbackBar({
  value = null,
  onValueChange,
  onCopy,
  onRetry,
  className,
  ...props
}: FeedbackBarProps) {
  const toggleValue = React.useCallback(
    (nextValue: Exclude<FeedbackValue, null>) => {
      onValueChange?.(value === nextValue ? null : nextValue);
    },
    [onValueChange, value],
  );

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1 pt-1.5", className)}
      {...props}
    >
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        onClick={() => toggleValue("up")}
        aria-label="Mark response helpful"
        className={cn(
          "text-white/20 hover:text-white/50 hover:bg-transparent",
          value === "up" && "text-white/60",
        )}
      >
        <ThumbsUp className="size-3" />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        onClick={() => toggleValue("down")}
        aria-label="Mark response unhelpful"
        className={cn(
          "text-white/20 hover:text-white/50 hover:bg-transparent",
          value === "down" && "text-white/60",
        )}
      >
        <ThumbsDown className="size-3" />
      </Button>
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
      {onRetry ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={onRetry}
          aria-label="Retry response"
          className="text-white/20 hover:text-white/50 hover:bg-transparent"
        >
          <ArrowCounterClockwise className="size-3" />
        </Button>
      ) : null}
    </div>
  );
}
