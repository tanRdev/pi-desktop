import { ChatText, Plus } from "@phosphor-icons/react";
import type { ThreadSnapshot } from "@pidesk/shared";
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
    <section className="space-y-3 px-2 pt-3">
      {/* Header - Clean, minimal */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-2 px-1">
        <div className="flex items-center gap-2">
          <ChatText
            className="size-4 text-[var(--color-text-tertiary)]"
            weight="regular"
          />
          <span className="text-[12px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            Threads
          </span>
          <span className="text-[11px] text-[var(--color-text-quaternary)]">
            {threads.length}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-[var(--color-text-tertiary)] transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] active:scale-95"
          onClick={() => onCreate()}
          aria-label="Create thread"
        >
          <Plus className="size-3.5" weight="bold" />
        </Button>
      </div>

      {/* Thread list - Clean, minimal cards */}
      <div className="space-y-0.5">
        {threads.length === 0 ? (
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)] px-3 py-4 text-center stagger-item">
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              No threads yet
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-text-quaternary)]">
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
                  "active-accent-left group relative w-full rounded-lg px-3 py-2.5 text-left transition-all duration-[var(--duration-fast)]",
                  isActive
                    ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] active"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
                  "stagger-item",
                )}
                data-active={isActive}
                style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ChatText
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isActive
                            ? "text-[var(--color-accent)]"
                            : "text-[var(--color-text-quaternary)] group-hover:text-[var(--color-text-tertiary)]",
                        )}
                        weight="regular"
                      />
                      <span
                        className={cn(
                          "truncate text-[13px] font-medium leading-tight",
                          isActive
                            ? "text-[var(--color-text-primary)]"
                            : "text-[var(--color-text-secondary)]",
                        )}
                      >
                        {thread.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-[var(--color-text-quaternary)]">
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
