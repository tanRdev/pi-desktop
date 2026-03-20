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
    <section className="space-y-2 px-3 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Threads
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 rounded border border-border bg-surface-2 text-foreground",
            "transition-[transform,background-color,border-color] duration-150 ease-out",
            "hover:bg-surface-3 hover:scale-105",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/10",
            "active:scale-[0.97] active:duration-100",
          )}
          onClick={() => onCreate()}
          aria-label="Create thread"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-1">
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
                "motion-safe:stagger-item w-full rounded-lg border p-3 text-left",
                "transition-[transform,opacity,background-color,border-color,box-shadow] duration-200 ease-out",
                "hover:translate-x-0.5 hover:shadow-sm",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/10",
                "active:scale-[0.97] active:duration-100",
                thread.id === activeThreadId
                  ? "border-border-hover bg-surface-2 shadow-sm"
                  : "border-border bg-surface-1 hover:bg-surface-2",
              )}
              style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium text-foreground">
                      {thread.title}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {formatActivity(thread.lastActivityAt)}
                  </div>
                </div>
                <RuntimeStatusChip status={thread.runtime.status} />
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
