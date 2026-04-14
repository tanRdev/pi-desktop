import { ChatText, Plus } from "@phosphor-icons/react";
import type { ThreadSnapshot } from "@pi-desktop/shared";
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
    return "No activity";
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ThreadList({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
}: ThreadListProps) {
  return (
    <section className="space-y-3 px-2 pt-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-2 px-1 select-none">
        <div className="flex items-center gap-2">
          <ChatText className="size-5 text-white/30" weight="regular" />
          <span className="text-[14px] font-medium text-white/30 uppercase tracking-[0.16em]">
            Threads
          </span>
          <span className="text-[14px] text-white/20">{threads.length}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-sm text-white/30 transition-all duration-150 hover:bg-white/[0.04] hover:text-white/60 active:scale-95"
          onClick={() => onCreate()}
          aria-label="Create thread"
        >
          <Plus className="size-5" weight="bold" />
        </Button>
      </div>

      {/* Thread list */}
      <div className="space-y-0.5">
        {threads.length === 0 ? (
          <div className="rounded-sm border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center">
            <p className="text-[16px] text-white/50">No threads yet</p>
            <p className="mt-1 text-[14px] text-white/30">
              Create one to start chatting
            </p>
          </div>
        ) : (
          threads.map((thread, index) => {
            const isActive = thread.id === activeThreadId;

            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelect(thread.id)}
                className={cn(
                  "group relative w-full rounded-sm px-3 py-2.5 text-left transition-all duration-150",
                  isActive
                    ? "bg-white/[0.06] text-white/80"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/70",
                )}
                data-active={isActive}
                style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ChatText
                        className={cn(
                          "size-5 shrink-0 transition-colors",
                          isActive
                            ? "text-white/60"
                            : "text-white/20 group-hover:text-white/30",
                        )}
                        weight="regular"
                      />
                      <span
                        className={cn(
                          "truncate text-[16px] font-medium leading-none",
                          isActive ? "text-white/80" : "text-white/50",
                        )}
                      >
                        {thread.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-6">
                      <span className="text-[14px] text-white/20">
                        {formatActivity(thread.lastActivityAt)}
                      </span>
                    </div>
                  </div>
                  <RuntimeStatusChip
                    status={thread.runtime.status}
                    className="h-4 px-1.5 shrink-0"
                  />
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
