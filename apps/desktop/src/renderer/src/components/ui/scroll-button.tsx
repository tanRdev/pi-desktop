import { ArrowDown } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export interface ScrollButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  count?: number;
}

export function ScrollButton({
  count = 0,
  className,
  children,
  ...props
}: ScrollButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#0C0D0F] px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
        "transition-[transform,border-color,background-color] duration-150 ease-out",
        "hover:border-white/[0.14] hover:bg-[#1e1e1e] active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      <ArrowDown className="size-5" />
      <span>{children ?? "Latest"}</span>
      {count > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-white/[0.08] px-1 text-[9px]">
          {count}
        </span>
      ) : null}
    </button>
  );
}
