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
  text = "Pi is responding",
  onStop,
  stopLabel = "Answer now",
  onClick,
}: ThinkingBarProps) {
  const words = text.split(" ");

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 px-1 py-1",
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
          <div className="flex gap-1.5">
            {words.map((word, i) => (
              <span
                key={i}
                className="animate-[word-pulse_2s_infinite_ease-in-out] will-change-transform"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <TextShimmer className="font-medium">{word}</TextShimmer>
              </span>
            ))}
          </div>
          <ChevronRight className="size-4 text-white/20 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      ) : (
        <div className="flex gap-1.5">
          {words.map((word, i) => (
            <span
              key={i}
              className="animate-[word-pulse_2s_infinite_ease-in-out] will-change-transform"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <TextShimmer className="cursor-default font-medium">
                {word}
              </TextShimmer>
            </span>
          ))}
        </div>
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
