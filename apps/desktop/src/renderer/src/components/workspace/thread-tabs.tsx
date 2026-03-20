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
    <div className="flex h-9 items-center border-b border-border bg-surface-2 px-2">
      <div className="flex min-w-0 flex-1 gap-0.5">
        {openThreads.map((thread, index) => {
          const isActive = thread.id === activeThreadId;
          const isRunning = thread.runtime.status === "streaming";

          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                "motion-safe:stagger-item group flex min-w-0 max-w-[160px] flex-1 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left",
                "transition-[transform,opacity,background-color,border-color] duration-200 ease-out",
                "hover:scale-[1.02] hover:shadow-sm",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/10",
                "active:scale-[0.97] active:duration-100",
                isActive
                  ? "border-border-hover bg-surface-1 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-surface-3 hover:text-foreground",
              )}
              style={{ animationDelay: `${Math.min(index * 30, 240)}ms` }}
            >
              {/* Status dot */}
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300",
                  isRunning
                    ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] animate-pulse"
                    : "bg-zinc-400",
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
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded",
                  "opacity-0 transition-[opacity,transform,background-color] duration-150 ease-out",
                  "hover:bg-surface-3 hover:scale-110",
                  "focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground/10",
                  "active:scale-[0.97] active:duration-100",
                  "group-hover:opacity-100",
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
