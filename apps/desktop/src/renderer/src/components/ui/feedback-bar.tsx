import { Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
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
      className={cn(
        "flex flex-wrap items-center gap-1.5 border-t border-[#474747]/18 pt-2",
        className,
      )}
      {...props}
    >
      <Button
        type="button"
        size="icon-xs"
        variant={value === "up" ? "secondary" : "ghost"}
        onClick={() => toggleValue("up")}
        aria-label="Mark response helpful"
      >
        <ThumbsUp className="size-3" />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant={value === "down" ? "secondary" : "ghost"}
        onClick={() => toggleValue("down")}
        aria-label="Mark response unhelpful"
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
        >
          <RotateCcw className="size-3" />
        </Button>
      ) : null}
    </div>
  );
}
