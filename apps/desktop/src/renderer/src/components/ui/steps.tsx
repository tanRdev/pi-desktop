import { Check, Circle, Loader2, X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type StepState = "complete" | "current" | "pending" | "error";

export interface StepItemProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  detail?: string;
  state?: StepState;
}

function StepIcon({ state }: { state: StepState }) {
  switch (state) {
    case "complete":
      return <Check className="size-3.5" />;
    case "current":
      return <Loader2 className="size-3.5 animate-spin" />;
    case "error":
      return <X className="size-3.5" />;
    default:
      return <Circle className="size-3.5" />;
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
        "flex items-start gap-3 border border-[#474747]/20 bg-[#101010]/94 px-3 py-2.5",
        state === "current" && "border-white/28",
        state === "error" && "border-[#7f4141]/35 text-[#f0c9c9]",
        className,
      )}
      {...props}
    >
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-current/20 text-current">
        <StepIcon state={state} />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/82">
          {title}
        </div>
        {detail ? (
          <div className="mt-1 text-[12px] leading-5 text-[#818181]">
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
