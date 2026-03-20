import type { WorktreeSnapshot } from "@pidesk/shared";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Loader2,
  Plus,
} from "lucide-react";
import * as React from "react";
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
  onCreateThread: () => void | Promise<void>;
  onCloseThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
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
  onRenameThread,
}: WorktreeSectionProps) {
  const [isCreatingThread, setIsCreatingThread] = React.useState(false);

  const handleCreateThread = React.useCallback(async () => {
    setIsCreatingThread(true);
    try {
      await onCreateThread();
    } finally {
      setIsCreatingThread(false);
    }
  }, [onCreateThread]);

  const visibleThreads = worktree.threads.filter(
    (thread) => !thread.isArchived,
  );

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
          "transition-[transform,background-color,color] duration-200 ease-out",
          "hover:bg-surface-2/50 hover:translate-x-0.5",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/10",
          "active:scale-[0.97] active:duration-100",
          isExpanded
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center",
            "transition-transform duration-200 ease-out",
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{worktree.label}</span>
        <GitStatusChip git={worktree.git} />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="py-1 pl-7 pr-2">
            <div className="space-y-0.5">
              {visibleThreads.length > 0 ? (
                visibleThreads.map((thread, index) => (
                  <div
                    key={thread.id}
                    className="motion-safe:stagger-item"
                    style={{ animationDelay: `${Math.min(index * 30, 240)}ms` }}
                  >
                    <ThreadListItem
                      thread={thread}
                      isActive={thread.id === activeThreadId}
                      onClick={() => onSelectThread(thread.id)}
                      onClose={
                        onCloseThread ? () => onCloseThread(thread.id) : undefined
                      }
                      onRename={
                        onRenameThread
                          ? (title: string) => onRenameThread(thread.id, title)
                          : undefined
                      }
                    />
                  </div>
                ))
              ) : (
                <div className="chrome-empty-state px-2 py-2 text-xs text-muted-foreground motion-safe:stagger-item">
                  No visible threads
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label="Create thread"
              disabled={isCreatingThread}
              className={cn(
                "mt-1 flex h-6 w-full items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground",
                "transition-[transform,opacity,background-color,color] duration-150 ease-out",
                "hover:bg-surface-2 hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/10",
                "active:scale-[0.97] active:duration-100",
                isCreatingThread && "pointer-events-none opacity-50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                void handleCreateThread();
              }}
            >
              {isCreatingThread ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {isCreatingThread ? "Creating…" : "New thread"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
