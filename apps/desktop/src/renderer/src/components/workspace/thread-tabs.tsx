import type { ThreadSnapshot } from "@pi-desktop/shared";
import { Plus, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface ThreadTabsProps {
  threads: ThreadSnapshot[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCloseThread: (threadId: string) => void;
  onCreateThread: () => void | Promise<void>;
}

export function ThreadTabs({
  threads,
  activeThreadId,
  onSelectThread,
  onCloseThread,
  onCreateThread,
}: ThreadTabsProps) {
  const openThreads = threads.filter((t) => !t.isArchived);

  return (
    <div
      data-testid="thread-tabs"
      className="flex h-8 items-center border-b border-white/[0.04] bg-[var(--color-bg-secondary)] px-0 select-none"
    >
      <div className="flex min-w-0 flex-1 h-full gap-0 overflow-x-auto no-scrollbar select-none">
        {openThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isRunning = thread.runtime.status === "streaming";

          return (
            <div
              key={thread.id}
              className={cn(
                "group flex min-w-0 max-w-[200px] flex-1 items-center gap-2 border-r border-white/[0.04] px-3 h-full text-left transition-all duration-75",
                isActive
                  ? "bg-white/[0.04] text-white/80"
                  : "bg-transparent text-white/30 hover:bg-white/[0.02] hover:text-white/50",
              )}
            >
              <button
                type="button"
                data-testid="thread-tab-select"
                aria-label={thread.title || "UNTITLED_THREAD"}
                onClick={() => onSelectThread(thread.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
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
                <span className="flex-1 truncate text-[14px] font-mono font-medium uppercase tracking-widest">
                  {thread.title || "UNTITLED_THREAD"}
                </span>
              </button>

              <button
                type="button"
                data-testid="thread-tab-close"
                aria-label={`Close ${thread.title || "thread"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseThread(thread.id);
                }}
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-xs transition-all duration-75",
                  isActive
                    ? "text-white/30 hover:text-white/60 hover:bg-white/[0.06]"
                    : "text-white/20 hover:text-white/50 hover:bg-white/[0.06]",
                  "opacity-0 group-hover:opacity-100",
                  isActive && "opacity-100",
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          data-testid="create-thread-button"
          aria-label="Create thread"
          onClick={() => {
            void onCreateThread();
          }}
          className="flex h-full shrink-0 items-center justify-center border-r border-white/[0.04] px-3 text-white/30 transition-all duration-75 hover:bg-white/[0.02] hover:text-white/60"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
