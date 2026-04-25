import { Check, Circle, Spinner, X } from "@phosphor-icons/react";
import { cn } from "@pi-desktop/ui";
import type * as React from "react";

export type StepState = "complete" | "current" | "pending" | "error";

export interface StepItemProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  detail?: string;
  state?: StepState;
}

function StepIcon({ state }: { state: StepState }) {
  switch (state) {
    case "complete":
      return <Check className="size-5" />;
    case "current":
      return <Spinner className="size-5 animate-spin" />;
    case "error":
      return <X className="size-5" />;
    default:
      return <Circle className="size-5" />;
  }
}

export function StepItem({
  title,
  detail,
  state = "pending",
  className,
  ...props
}: StepItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border border-white/[0.04] bg-white/[0.02] px-3 py-2.5",
        state === "current" && "border-white/[0.08]",
        state === "error" && "border-red-400/20 text-red-300/80",
        className,
      )}
      {...props}
    >
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-current/20 text-current">
        <StepIcon state={state} />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/80">
          {title}
        </div>
        {detail ? (
          <div className="mt-1 text-[11px] leading-normal text-white/40">
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface StepsProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Steps({ className, ...props }: StepsProps) {
  return <div className={cn("space-y-2", className)} {...props} />;
}
