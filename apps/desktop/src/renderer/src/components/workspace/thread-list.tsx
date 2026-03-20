import type { ThreadSnapshot } from "@pidesk/shared";
import { MessageSquare, Plus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { RuntimeStatusChip } from "./runtime-status-chip";

export interface ThreadListProps {
  threads: ThreadSnapshot[];
  activeThreadId: string | null;
  onSelect: (threadId: string) => void | Promise<void>;
  onCreate: () => void | Promise<void>;
}

function formatActivity(timestamp: number | null): string {
  if (!timestamp) {
    return "No activity yet";
  }

  return new Date(timestamp).toLocaleString();
}

export function ThreadList({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
}: ThreadListProps) {
  return (
    <section className="space-y-3 px-3 pt-4">
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-[#474747]">
          Threads
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-6 border-none bg-primary text-[#131313]",
            "transition-all duration-150 ease-out",
            "hover:bg-[#d4d4d4] hover:scale-105",
            "active:scale-[0.98]",
          )}
          onClick={() => onCreate()}
          aria-label="Create thread"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-0.5">
        {threads.length === 0 ? (
          <div className="chrome-empty-state px-3 py-4 text-xs text-muted-foreground motion-safe:stagger-item">
            No threads for this worktree yet.
          </div>
        ) : (
          threads.map((thread, index) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelect(thread.id)}
              className={cn(
                "motion-safe:stagger-item group w-full p-3 text-left font-mono",
                "transition-all duration-200 ease-out",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                thread.id === activeThreadId
                  ? "bg-[#353535] text-[#ffffff]"
                  : "bg-transparent text-[#ffffff]/60 hover:bg-[#353535]/50 hover:text-[#ffffff]",
              )}
              style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-3 shrink-0 text-inherit" />
                    <span className="truncate text-[11px] font-bold uppercase tracking-tight">
                      {thread.title}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[9px] uppercase tracking-wider text-inherit/50">
                    {formatActivity(thread.lastActivityAt)}
                  </div>
                </div>
                <RuntimeStatusChip
                  status={thread.runtime.status}
                  className="h-4 px-1.5"
                />
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
