import type { ThreadSnapshot } from "@pidesk/shared";
import { MessageSquare, Plus } from "lucide-react";
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
          className="size-7 rounded border border-border bg-surface-2 text-foreground hover:bg-surface-3"
          onClick={() => onCreate()}
          aria-label="Create thread"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-1">
        {threads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            No threads for this worktree yet.
          </div>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelect(thread.id)}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition",
                thread.id === activeThreadId
                  ? "border-border-hover bg-surface-2"
                  : "border-border bg-surface-1 hover:bg-surface-2",
              )}
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
