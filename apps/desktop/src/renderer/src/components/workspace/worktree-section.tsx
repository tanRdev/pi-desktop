import {
  CaretDown,
  CaretRight,
  GitBranch,
  Plus,
  Spinner,
} from "@phosphor-icons/react";
import type { WorktreeSnapshot } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { GitStatusChip } from "./git-status-chip";
import { ThreadListItem } from "./thread-list-item";

export interface WorktreeSectionProps {
  worktree: WorktreeSnapshot;
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
    <div
      data-testid="worktree-section"
      data-worktree-id={worktree.id}
      data-worktree-label={worktree.label}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
          isExpanded
            ? "text-[#e7e7e7]"
            : "text-[#6a6a6a] hover:text-[#8a8a8a] hover:bg-[#1a1a1a]/50",
        )}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center text-[#6a6a6a]">
          {isExpanded ? (
            <CaretDown className="size-3" />
          ) : (
            <CaretRight className="size-3" />
          )}
        </span>
        <GitBranch className="size-3 shrink-0 text-[#6a6a6a]" />
        <span className="truncate font-medium">{worktree.label}</span>
        <GitStatusChip git={worktree.git} />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="py-0.5 pl-6 pr-0.5">
            <div className="space-y-0">
              {visibleThreads.length > 0 ? (
                visibleThreads.map((thread, index) => (
                  <div
                    key={thread.id}
                    className="stagger-item"
                    style={{ animationDelay: `${Math.min(index * 20, 160)}ms` }}
                  >
                    <ThreadListItem
                      thread={thread}
                      isActive={thread.id === activeThreadId}
                      onClick={() => onSelectThread(thread.id)}
                      onClose={
                        onCloseThread
                          ? () => onCloseThread(thread.id)
                          : undefined
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
                <div className="px-2 py-1.5 text-[11px] text-[#6a6a6a]">
                  No threads
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="create-thread-button"
              aria-label="Create thread"
              disabled={isCreatingThread}
              className={cn(
                "mt-0.5 flex h-5 w-full items-center gap-1 rounded px-1.5 text-[11px] text-[#6a6a6a]",
                "transition-colors hover:bg-[#1a1a1a] hover:text-[#8a8a8a]",
                isCreatingThread && "pointer-events-none opacity-50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                void handleCreateThread();
              }}
            >
              {isCreatingThread ? (
                <Spinner className="size-2.5 animate-spin" />
              ) : (
                <Plus className="size-2.5" />
              )}
              {isCreatingThread ? "Creating…" : "New thread"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
