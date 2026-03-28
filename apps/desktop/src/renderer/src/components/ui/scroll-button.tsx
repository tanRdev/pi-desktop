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
        "inline-flex items-center gap-2 border border-[#474747]/25 bg-[#0f0f0f]/96 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white shadow-[0_18px_40px_rgba(0,0,0,0.24)]",
        "transition-[transform,border-color,background-color] duration-150 ease-out",
        "hover:border-white/40 hover:bg-[#171717] active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      <ArrowDown className="size-3.5" />
      <span>{children ?? "Latest"}</span>
      {count > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center border border-white/15 px-1 text-[9px]">
          {count}
        </span>
      ) : null}
    </button>
  );
}
