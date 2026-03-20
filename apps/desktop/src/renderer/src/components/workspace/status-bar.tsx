import type { ThreadSnapshot } from "@pidesk/shared";
import { cn } from "@/lib/utils";

export interface StatusBarProps {
  tmuxSessionName?: string | null;
  activeThread: ThreadSnapshot | null;
  agentStatus: string;
}

export function StatusBar({
  tmuxSessionName,
  activeThread,
  agentStatus,
}: StatusBarProps) {
  // Determine running state
  const isRunning = activeThread
    ? activeThread.runtime.status === "streaming"
    : agentStatus === "streaming";
  return (
    <div
      className={cn(
        "flex h-6 items-center justify-between border-b border-border bg-surface-1 px-3 text-[10px]",
        "transition-colors duration-[var(--duration-fast)]",
        "motion-reduce:transition-none",
      )}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      {/* Left: tmux session name */}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {tmuxSessionName && (
          <>
            <span className="opacity-50">tmux:</span>
            <span
              className={cn(
                "font-mono text-foreground/70",
                "transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none",
              )}
              style={{ transitionTimingFunction: "var(--ease-out)" }}
            >
              {tmuxSessionName}
            </span>
          </>
        )}
      </div>

      {/* Right: running indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-all duration-[var(--duration-slow)] motion-reduce:transition-none",
            isRunning
              ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse motion-reduce:animate-none"
              : "bg-zinc-400",
          )}
          style={{ transitionTimingFunction: "var(--ease-out)" }}
        />
        <span
          className={cn(
            "text-muted-foreground transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none",
            isRunning && "text-emerald-500/80",
          )}
          style={{ transitionTimingFunction: "var(--ease-out)" }}
        >
          {isRunning ? "Running" : "Idle"}
        </span>
      </div>
    </div>
  );
}
