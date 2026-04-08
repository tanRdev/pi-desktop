import type * as React from "react";
import { cn } from "@/lib/utils";

export interface PromptSuggestionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  description?: string;
}

export function PromptSuggestion({
  title,
  description,
  className,
  ...props
}: PromptSuggestionProps) {
  return (
    <button
      type="button"
      className={cn(
        "group inline-flex h-9 min-w-fit shrink-0 items-center gap-2.5 whitespace-nowrap border border-white/[0.06] bg-[#111111] px-3 text-left",
        "transition-[transform,border-color,background-color,color] duration-150 ease-out",
        "hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/80 active:scale-[0.99]",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-1.5 truncate">
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-white/80">
          {title}
        </span>
        {description ? (
          <>
            <span aria-hidden="true" className="text-white/30">
              /
            </span>
            <span className="truncate text-[10px] text-white/40 group-hover:text-white/60">
              {description}
            </span>
          </>
        ) : null}
      </div>
    </button>
  );
}

export interface PromptSuggestionGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export function PromptSuggestionGroup({
  className,
  ...props
}: PromptSuggestionGroupProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  );
}
