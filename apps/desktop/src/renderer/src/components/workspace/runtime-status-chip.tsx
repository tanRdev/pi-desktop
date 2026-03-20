import type { ThreadRuntimeStatus } from "@pidesk/shared";
import { cn } from "@/lib/utils";

export interface RuntimeStatusChipProps {
  status: ThreadRuntimeStatus;
  className?: string;
  testId?: string;
}

const STATUS_STYLES: Record<ThreadRuntimeStatus, string> = {
  starting: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  ready: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  streaming: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  disconnected: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  exited: "border-zinc-500/30 bg-zinc-500/10 text-zinc-200",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-100",
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
        "inline-flex items-center border px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-widest",
        "transition-all duration-[var(--duration-normal)] motion-reduce:transition-none",
        "hover:bg-primary hover:text-[#131313] active:scale-[0.98] motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0",
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
