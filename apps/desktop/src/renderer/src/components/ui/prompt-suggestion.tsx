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
        "group inline-flex h-9 min-w-fit shrink-0 items-center gap-2.5 whitespace-nowrap border border-[#474747]/25 bg-[#111111]/92 px-3 text-left",
        "transition-[transform,border-color,background-color,color] duration-150 ease-out",
        "hover:border-white/35 hover:bg-[#171717] hover:text-white active:scale-[0.99]",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-1.5 truncate">
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-white/88">
          {title}
        </span>
        {description ? (
          <>
            <span aria-hidden="true" className="text-[#4f4f4f]">
              /
            </span>
            <span className="truncate text-[10px] text-[#7e7e7e] group-hover:text-[#b5b5b5]">
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
