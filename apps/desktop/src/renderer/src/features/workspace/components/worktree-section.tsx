import {
  CaretDown,
  CaretRight,
  GitBranch,
  Plus,
  Spinner,
} from "@phosphor-icons/react";
import type { WorktreeSnapshot } from "@pi-desktop/shared";
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
}

export function WorktreeSection({
  worktree,
  activeThreadId,
  isExpanded,
  onToggleExpand,
  onSelectThread,
  onCreateThread,
  onCloseThread,
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

  const isWorktreeActive = worktree.threads.some(
    (thread) => thread.id === activeThreadId,
  );

  return (
    <div
      data-testid="worktree-section"
      data-worktree-id={worktree.id}
      data-worktree-label={worktree.label}
    >
      {/* Worktree Header - Linear style: minimal, muted inactive state */}
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "group flex w-full items-center gap-1.5 px-1.5 py-1.5 text-left transition-all duration-[var(--duration-fast)]",
          isExpanded || isWorktreeActive
            ? "text-white/65"
            : "text-white/30 hover:text-white/50",
        )}
      >
        <GitBranch
          className={cn(
            "size-3 shrink-0 transition-colors",
            isExpanded || isWorktreeActive
              ? "text-white/40"
              : "text-white/20 group-hover:text-white/35",
          )}
          weight="regular"
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[10.5px] leading-none",
            isExpanded || isWorktreeActive
              ? "text-white/70 font-normal"
              : "group-hover:text-white/55",
          )}
        >
          {worktree.label}
        </span>
        <span
          className={cn(
            "flex size-3 shrink-0 items-center justify-center transition-colors",
            isExpanded
              ? "text-white/40"
              : "text-white/15 group-hover:text-white/30",
          )}
        >
          {isExpanded ? (
            <CaretDown className="size-2.5" weight="bold" />
          ) : (
            <CaretRight className="size-2.5" weight="bold" />
          )}
        </span>
      </button>

      {/* Thread List - seamlessly connected with vertical line */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="relative py-1">
            {/* Vertical connector line for threads - stronger when active */}
            <div
              className={cn(
                "absolute left-[11px] top-0 bottom-2 w-px bg-gradient-to-b",
                isWorktreeActive
                  ? "from-white/[0.08] via-white/[0.05] to-transparent"
                  : "from-white/[0.04] via-white/[0.03] to-transparent",
              )}
            />
            <div className="space-y-0 pl-6">
              {worktree.threads.map((thread, index) => (
                <div
                  key={thread.id}
                  className="stagger-item relative"
                  style={{ animationDelay: `${Math.min(index * 20, 160)}ms` }}
                >
                  {/* Horizontal connector line - stronger when thread is active */}
                  <div
                    className={cn(
                      "absolute left-[-9px] top-[13px] w-3 h-px",
                      thread.id === activeThreadId
                        ? "bg-white/[0.08]"
                        : "bg-white/[0.04]",
                    )}
                  />
                  <ThreadListItem
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    onClick={() => onSelectThread(thread.id)}
                    onClose={
                      onCloseThread ? () => onCloseThread(thread.id) : undefined
                    }
                  />
                </div>
              ))}
            </div>

            {/* New chat button - connected to tree */}
            <button
              type="button"
              data-testid="create-thread-button"
              aria-label="Start new chat"
              disabled={isCreatingThread}
              className={cn(
                "relative mt-1 flex h-7 w-full items-center gap-1.5 px-1.5 py-1 text-[10.5px]",
                "text-white/25 transition-all duration-[var(--duration-fast)]",
                "hover:bg-white/[0.04] hover:text-white/50",
                isCreatingThread && "pointer-events-none opacity-50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                void handleCreateThread();
              }}
            >
              {/* Horizontal connector */}
              <div className="absolute left-[-9px] top-1/2 -translate-y-1/2 w-3 h-px bg-white/[0.03]" />
              {isCreatingThread ? (
                <Spinner className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" weight="bold" />
              )}
              <span>{isCreatingThread ? "Creating…" : "New chat"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
