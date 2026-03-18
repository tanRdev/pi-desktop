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
    <div className="flex h-6 items-center justify-between border-b border-border bg-surface-1 px-3 text-[10px]">
      {/* Left: tmux session name */}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {tmuxSessionName && (
          <>
            <span className="opacity-50">tmux:</span>
            <span className="font-mono text-foreground/70">
              {tmuxSessionName}
            </span>
          </>
        )}
      </div>

      {/* Right: running indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isRunning
              ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"
              : "bg-zinc-400",
          )}
        />
        <span className="text-muted-foreground">
          {isRunning ? "Running" : "Idle"}
        </span>
      </div>
    </div>
  );
}
