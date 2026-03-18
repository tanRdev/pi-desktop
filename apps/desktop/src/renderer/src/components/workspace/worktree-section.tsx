import type { WorktreeSnapshot } from "@pidesk/shared";
import { ChevronDown, ChevronRight, GitBranch, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { GitStatusChip } from "./git-status-chip";
import { ThreadListItem } from "./thread-list-item";

export interface WorktreeSectionProps {
  worktree: WorktreeSnapshot;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
}

export function WorktreeSection({
  worktree,
  activeWorktreeId,
  activeThreadId,
  isExpanded,
  onToggleExpand,
  onSelectThread,
  onCreateThread,
}: WorktreeSectionProps) {
  const isActive = worktree.id === activeWorktreeId;
  const visibleThreads = worktree.threads.filter(
    (thread) => !thread.isArchived,
  );
  const runningThreads = visibleThreads.filter(
    (t) => !t.isArchived && t.runtime.status === "streaming",
  ).length;

  return (
    <div className="mb-1 last:mb-0">
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "w-full rounded-xl border px-3 py-2.5 text-left transition",
          isActive
            ? "border-border bg-surface-2 text-foreground shadow-sm"
            : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-2/70 hover:text-foreground",
        )}
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>

          <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid={isActive ? "current-worktree-label" : undefined}
                className="truncate text-xs font-semibold"
              >
                {worktree.label}
              </span>
              {isActive ? (
                <span className="rounded-full border border-border bg-surface-1 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Current
                </span>
              ) : null}
              {worktree.isMain ? (
                <span className="rounded-full border border-border bg-surface-1 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Main
                </span>
              ) : null}
              {worktree.isDetached ? (
                <span className="rounded-full border border-border bg-surface-1 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Detached
                </span>
              ) : null}
              <GitStatusChip git={worktree.git} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <span>
                {visibleThreads.length} thread
                {visibleThreads.length !== 1 ? "s" : ""}
              </span>
              {runningThreads > 0 ? (
                <span>{runningThreads} running</span>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-2 pt-1">
          <div className="space-y-1 pl-8">
            {visibleThreads.map((thread) => (
              <ThreadListItem
                key={thread.id}
                thread={thread}
                isActive={thread.id === activeThreadId}
                onClick={() => onSelectThread(thread.id)}
              />
            ))}

            {visibleThreads.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface-2/40 px-2 py-2 text-[10px] text-muted-foreground">
                No threads yet
              </div>
            )}
          </div>

          <div className="mt-2 pl-8">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Create thread"
              className="h-6 w-full justify-start gap-1.5 rounded-md border border-transparent px-2 text-[10px] text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onCreateThread();
              }}
            >
              <Plus className="h-3 w-3" />
              New thread
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
