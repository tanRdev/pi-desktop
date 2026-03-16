import type { ThreadSnapshot } from "@pidesk/shared";
import { X } from "lucide-react";
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
    <div className="flex h-9 items-center border-b border-border bg-surface-2 px-2">
      <div className="flex min-w-0 flex-1 gap-0.5">
        {openThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isRunning = thread.runtime.status === "streaming";

          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                "group flex min-w-0 max-w-[160px] flex-1 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition",
                isActive
                  ? "border-border-hover bg-surface-1 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-surface-3 hover:text-foreground",
              )}
            >
              {/* Status dot */}
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isRunning ? "bg-emerald-500" : "bg-zinc-400",
                )}
              />

              {/* Thread name */}
              <span className="flex-1 truncate text-xs">
                {thread.title || "Untitled"}
              </span>

              {/* Close button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseThread(thread.id);
                }}
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition",
                  "group-hover:opacity-100 hover:bg-surface-3",
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
