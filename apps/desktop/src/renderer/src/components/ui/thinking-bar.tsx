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
        "flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2",
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
          <ChevronRight className="size-4 text-white/20 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      ) : (
        <TextShimmer className="cursor-default font-medium">{text}</TextShimmer>
      )}
      {onStop ? (
        <button
          onClick={onStop}
          type="button"
          className={cn(
            "text-white/30 border-white/[0.08] border-b border-dotted text-sm",
            "transition-all duration-150 ease-out",
            "hover:text-white/50 hover:border-white/20",
            "active:scale-95",
          )}
        >
          {stopLabel}
        </button>
      ) : null}
    </div>
  );
}
