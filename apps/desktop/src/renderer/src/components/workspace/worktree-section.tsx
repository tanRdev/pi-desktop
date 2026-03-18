import type { WorktreeSnapshot } from "@pidesk/shared";
import { ChevronDown, ChevronRight, GitBranch, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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
  onCloseThread?: (threadId: string) => void;
}

export function WorktreeSection({
  worktree,
  activeWorktreeId,
  activeThreadId,
  isExpanded,
  onToggleExpand,
  onSelectThread,
  onCreateThread,
  onCloseThread,
}: WorktreeSectionProps) {
  const visibleThreads = worktree.threads.filter(
    (thread) => !thread.isArchived,
  );

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          isExpanded
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center transition-transform duration-200">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">{worktree.label}</span>
        <GitStatusChip git={worktree.git} />
      </button>

      {isExpanded && (
        <div className="overflow-hidden transition-all duration-200 ease-out">
          <div className="py-1 pl-7 pr-2">
            <div className="space-y-0.5">
              {visibleThreads.map((thread) => (
                <ThreadListItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onClick={() => onSelectThread(thread.id)}
                  onClose={
                    onCloseThread ? () => onCloseThread(thread.id) : undefined
                  }
                />
              ))}
            </div>

            <button
              type="button"
              aria-label="Create thread"
              className="mt-1 flex h-6 w-full items-center gap-1.5 rounded-md px-2 text-[10px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onCreateThread();
              }}
            >
              <Plus className="h-3 w-3" />
              New thread
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
