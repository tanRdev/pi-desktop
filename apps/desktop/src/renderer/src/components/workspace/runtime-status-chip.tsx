import type { ThreadRuntimeStatus } from "@pidesk/shared";
import { cn } from "@/lib/utils";

export interface RuntimeStatusChipProps {
  status: ThreadRuntimeStatus;
  className?: string;
  testId?: string;
}

const STATUS_STYLES: Record<ThreadRuntimeStatus, string> = {
  starting: "border-sky-400/20 bg-sky-400/[0.06] text-sky-300/70",
  ready: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300/70",
  streaming: "border-violet-400/20 bg-violet-400/[0.06] text-violet-300/70",
  disconnected: "border-amber-400/20 bg-amber-400/[0.06] text-amber-300/70",
  exited: "border-white/[0.06] bg-white/[0.03] text-white/30",
  error: "border-rose-400/20 bg-rose-400/[0.06] text-rose-300/70",
};

const STATUS_ANIMATIONS: Record<ThreadRuntimeStatus, string> = {
  starting: "animate-pulse",
  ready: "",
  streaming: "animate-pulse",
  disconnected: "animate-pulse",
  exited: "",
  error: "animate-pulse",
};

export function RuntimeStatusChip({
  status,
  className,
  testId,
}: RuntimeStatusChipProps) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-widest rounded-md",
        "transition-all duration-150 motion-reduce:transition-none",
        "hover:brightness-125 active:scale-[0.98] motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 focus-visible:ring-offset-0",
        STATUS_STYLES[status],
        STATUS_ANIMATIONS[status],
        className,
      )}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      {status}
    </span>
  );
}
