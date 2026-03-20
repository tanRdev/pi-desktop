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
  // Only show non-archived threads that have been "opened"
  // For now, show all non-archived threads as "open"
  const openThreads = threads.filter((t) => !t.isArchived);

  if (openThreads.length === 0) {
    return null;
  }

  return (
    <div className="flex h-8 items-center border-b border-[#474747]/30 bg-[#0e0e0e] px-0">
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
                "group flex min-w-0 max-w-[200px] flex-1 items-center gap-2 border-r border-[#474747]/20 px-3 h-full text-left transition-all duration-75",
                isActive
                  ? "bg-white text-black"
                  : "bg-[#0e0e0e] text-[#474747] hover:bg-[#131313] hover:text-[#919191]",
              )}
            >
              {/* Status indicator */}
              <div
                className={cn(
                  "h-1.5 w-1.5 shrink-0 transition-all duration-300",
                  isRunning
                    ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] animate-pulse"
                    : isActive
                      ? "bg-black/20"
                      : "bg-[#474747]/30",
                )}
              />

              {/* Thread name */}
              <span className="flex-1 truncate text-[10px] font-mono font-bold uppercase tracking-widest">
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
                  "flex h-4 w-4 shrink-0 items-center justify-center transition-all duration-75",
                  isActive
                    ? "text-black/40 hover:text-black hover:bg-black/5"
                    : "text-[#474747] hover:text-white hover:bg-[#353535]",
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
