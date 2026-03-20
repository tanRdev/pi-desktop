import { ExternalLink } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export interface SourceItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  detail?: string;
}

export function SourceItem({
  label,
  detail,
  className,
  ...props
}: SourceItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-2 border border-[#474747]/20 bg-[#101010] px-2.5 py-1.5 text-left",
        "transition-[transform,border-color,background-color,color] duration-150 ease-out",
        "hover:border-white/35 hover:bg-[#171717] hover:text-white active:scale-[0.99]",
        className,
      )}
      {...props}
    >
      <ExternalLink className="size-3.5 shrink-0 text-[#7a7a7a]" />
      <span className="min-w-0">
        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-white/82">
          {label}
        </span>
        {detail ? (
          <span className="block truncate text-[11px] text-[#7c7c7c]">
            {detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export interface SourceListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SourceList({ className, ...props }: SourceListProps) {
  return <div className={cn("flex flex-wrap gap-2", className)} {...props} />;
}

export const Source = SourceItem;
