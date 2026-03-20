"use client";

import { ChevronRight } from "@/components/ui/icons";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { cn } from "@/lib/utils";

type ThinkingBarProps = {
  className?: string;
  text?: string;
  onStop?: () => void;
  stopLabel?: string;
  onClick?: () => void;
};

export function ThinkingBar({
  className,
  text = "Thinking",
  onStop,
  stopLabel = "Answer now",
  onClick,
}: ThinkingBarProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3",
        "transition-opacity duration-150 ease-out",
        className,
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "flex items-center gap-1 text-sm",
            "transition-all duration-150 ease-out",
            "hover:opacity-80 active:scale-95",
          )}
        >
          <TextShimmer className="font-medium">{text}</TextShimmer>
          <ChevronRight className="text-muted-foreground size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      ) : (
        <TextShimmer className="cursor-default font-medium">{text}</TextShimmer>
      )}
      {onStop ? (
        <button
          onClick={onStop}
          type="button"
          className={cn(
            "text-muted-foreground border-muted-foreground/50 border-b border-dotted text-sm",
            "transition-all duration-150 ease-out",
            "hover:text-foreground hover:border-foreground",
            "active:scale-95",
          )}
        >
          {stopLabel}
        </button>
      ) : null}
    </div>
  );
}
