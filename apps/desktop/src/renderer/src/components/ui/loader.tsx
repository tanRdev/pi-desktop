import type * as React from "react";
import { cn } from "@/lib/utils";

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  size?: "sm" | "md";
}

export function Loader({
  label = "Loading",
  size = "sm",
  className,
  ...props
}: LoaderProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 font-mono uppercase tracking-[0.18em] text-white/30",
        size === "sm" ? "text-[10.5px]" : "text-[10.5px]",
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 rounded-full bg-current motion-safe:animate-[pulse_900ms_ease-in-out_infinite]"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
