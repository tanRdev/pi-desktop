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

  const hasActiveThread = visibleThreads.some(
    (thread) => thread.id === activeThreadId,
  );

  return (
    <div
      data-testid="worktree-section"
      data-worktree-id={worktree.id}
      data-worktree-label={worktree.label}
    >
      {/* Worktree Header - Clean, compact row */}
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "active-accent-left group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-all duration-[var(--duration-fast)]",
          isExpanded || hasActiveThread
            ? "text-[var(--color-text-secondary)]"
            : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]",
        )}
        data-active={hasActiveThread}
      >
        <span
          className={cn(
            "flex size-3.5 shrink-0 items-center justify-center rounded transition-colors",
            isExpanded
              ? "text-[var(--color-text-secondary)]"
              : "text-[var(--color-text-quaternary)] group-hover:text-[var(--color-text-tertiary)]",
          )}
        >
          {isExpanded ? (
            <CaretDown className="size-3" weight="bold" />
          ) : (
            <CaretRight className="size-3" weight="bold" />
          )}
        </span>
        <GitBranch
          className={cn(
            "size-3.5 shrink-0 transition-colors",
            isExpanded || hasActiveThread
              ? "text-[var(--color-text-tertiary)]"
              : "text-[var(--color-text-quaternary)]",
          )}
          weight="regular"
        />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight">
          {worktree.label}
        </span>
        {worktree.git.branch && (
          <span className="shrink-0 truncate max-w-[80px] text-[10px] text-[var(--color-text-quaternary)]">
            {worktree.git.branch}
          </span>
        )}
      </button>

      {/* Thread List - Collapsible with smooth animation */}
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
                <div className="px-2 py-1.5 text-[11px] text-[var(--color-text-quaternary)]">
                  No threads
                </div>
              )}
            </div>

            {/* New thread button - Subtle, minimal */}
            <button
              type="button"
              data-testid="create-thread-button"
              aria-label="Create thread"
              disabled={isCreatingThread}
              className={cn(
                "mt-0.5 flex h-5 w-full items-center gap-1.5 rounded px-1.5 text-[11px] text-[var(--color-text-quaternary)]",
                "transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-tertiary)]",
                isCreatingThread && "pointer-events-none opacity-50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                void handleCreateThread();
              }}
            >
              {isCreatingThread ? (
                <Spinner className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" weight="bold" />
              )}
              <span className="text-[11px]">
                {isCreatingThread ? "Creating…" : "New thread"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
