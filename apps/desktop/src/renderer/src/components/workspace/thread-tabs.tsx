import type { ThreadSnapshot } from "@pidesk/shared";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface ThreadTabsProps {
  threads: ThreadSnapshot[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCloseThread: (threadId: string) => void;
}

export function ThreadTabs({
  threads,
  activeThreadId,
  onSelectThread,
  onCloseThread,
}: ThreadTabsProps) {
  const openThreads = threads.filter((t) => !t.isArchived);

  if (openThreads.length === 0) {
    return null;
  }

  return (
    <div className="flex h-8 items-center border-b border-white/[0.04] bg-[#0d0d0d] px-0">
      <div className="flex min-w-0 flex-1 h-full gap-0 overflow-x-auto no-scrollbar">
        {openThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isRunning = thread.runtime.status === "streaming";

          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                "group flex min-w-0 max-w-[200px] flex-1 items-center gap-2 border-r border-white/[0.04] px-3 h-full text-left transition-all duration-75",
                isActive
                  ? "bg-white/[0.04] text-white/80"
                  : "bg-transparent text-white/30 hover:bg-white/[0.02] hover:text-white/50",
              )}
            >
              {/* Status indicator */}
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-300",
                  isRunning
                    ? "bg-emerald-400/70 shadow-[0_0_4px_rgba(16,185,129,0.4)] animate-pulse"
                    : isActive
                      ? "bg-white/20"
                      : "bg-white/10",
                )}
              />

              {/* Thread name */}
              <span className="flex-1 truncate text-[10px] font-mono font-medium uppercase tracking-widest">
                {thread.title || "UNTITLED_THREAD"}
              </span>

              {/* Close button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseThread(thread.id);
                }}
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-all duration-75",
                  isActive
                    ? "text-white/30 hover:text-white/60 hover:bg-white/[0.06]"
                    : "text-white/20 hover:text-white/50 hover:bg-white/[0.06]",
                  "opacity-0 group-hover:opacity-100",
                  isActive && "opacity-100",
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}
