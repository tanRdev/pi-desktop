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
  const activeThreadCount = worktree.threads.filter(
    (t) => !t.isArchived,
  ).length;
  const runningThreads = worktree.threads.filter(
    (t) => !t.isArchived && t.runtime.status === "streaming",
  ).length;

  return (
    <div className={cn("border-b border-border last:border-b-0")}>
      {/* Worktree header - clickable to expand/collapse */}
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left transition",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>

        <GitBranch className="h-3.5 w-3.5 shrink-0" />

        <div className="min-w-0 flex-1">
          {/* Single line: name + git badge */}
          <div className="flex items-center gap-2">
            <span
              data-testid={isActive ? "current-worktree-label" : undefined}
              className="truncate text-xs font-medium"
            >
              {worktree.label}
            </span>
            <GitStatusChip git={worktree.git} />
          </div>
          {/* Second line: thread count */}
          <div className="flex items-center gap-2 text-[10px] opacity-60">
            <span>
              {activeThreadCount} thread{activeThreadCount !== 1 ? "s" : ""}
            </span>
            {runningThreads > 0 && (
              <span className="text-emerald-500">{runningThreads} running</span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded thread list */}
      {isExpanded && (
        <div className="pb-2">
          <div className="space-y-0.5 pl-9 pr-2">
            {worktree.threads
              .filter((thread) => !thread.isArchived)
              .map((thread) => (
                <ThreadListItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onClick={() => onSelectThread(thread.id)}
                />
              ))}

            {worktree.threads.filter((t) => !t.isArchived).length === 0 && (
              <div className="px-2 py-2 text-[10px] text-muted-foreground opacity-60">
                No threads yet
              </div>
            )}
          </div>

          {/* Create thread button */}
          <div className="mt-1 pl-9 pr-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Create thread"
              className="h-6 w-full justify-start gap-1.5 px-2 text-[10px] text-muted-foreground hover:text-foreground"
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
