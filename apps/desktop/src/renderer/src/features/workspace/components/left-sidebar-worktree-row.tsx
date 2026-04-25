import { ArrowsLeftRight } from "@phosphor-icons/react";
import type { WorktreeSnapshot } from "@pi-desktop/shared";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@pi-desktop/ui";
import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Plus,
} from "@/components/ui/phosphor-icons";
import { ThreadRow } from "./left-sidebar-thread-row";
import { StatusIndicator, TreeConnector } from "./left-sidebar-tree-indicators";
import {
  type IndicatorState,
  passiveIndicatorState,
  type ThreadContextMenuHandler,
  type WorktreeContextMenuHandler,
} from "./left-sidebar-tree-types";

export interface WorktreeRowProps {
  session: WorktreeSnapshot;
  repositoryName: string;
  isActive: boolean;
  indicatorState: IndicatorState;
  activeThreadId: string | null;
  isPromptExecuting?: boolean;
  threadLastViewedAt?: Record<string, number>;
  onSelect: (id: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread?: (worktreeId: string) => void;
  onContextMenu?: WorktreeContextMenuHandler;
  onThreadContextMenu?: ThreadContextMenuHandler;
}

function WorktreeRowImpl({
  session,
  repositoryName,
  isActive,
  indicatorState,
  activeThreadId,
  isPromptExecuting,
  threadLastViewedAt,
  onSelect,
  onSelectThread,
  onCreateThread,
  onContextMenu,
  onThreadContextMenu,
}: WorktreeRowProps) {
  const ahead = session.git.ahead ?? 0;
  const behind = session.git.behind ?? 0;
  const isDirty = session.git.hasChanges ?? false;
  const prStatus = session.git.prStatus ?? null;
  const tooltipText = `${repositoryName} › ${session.label}`;

  const gitStateIcon = (() => {
    if (prStatus === "merged") {
      return <GitMerge className="size-3.5 text-[var(--color-accent)]" />;
    }
    if (prStatus === "open") {
      return <GitPullRequest className="size-3.5 text-sky-400" />;
    }
    if (ahead > 0 && behind > 0) {
      return <ArrowsLeftRight className="size-3.5 text-white/40" />;
    }
    if (ahead > 0) {
      return <ArrowUp className="size-3.5 text-[var(--color-accent)]" />;
    }
    if (behind > 0) {
      return <ArrowDown className="size-3.5 text-white/40" />;
    }
    if (isDirty) {
      return <GitBranch className="size-3.5 text-white/40" />;
    }
    return <Check className="size-3.5 text-white/50" />;
  })();

  return (
    <div data-testid="session-row">
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onSelect(session.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu?.(e, session.id, session.label);
              }}
              className={cn(
                "group flex min-w-0 flex-1 items-center gap-2 pl-[22px] pr-2 py-2 text-left text-[13px]",
                "transition-colors duration-150",
                isActive
                  ? "text-white"
                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.06]",
              )}
            >
              <StatusIndicator
                state={
                  isActive
                    ? indicatorState
                    : passiveIndicatorState(indicatorState)
                }
              />

              <span className="min-w-0 flex-1 truncate font-mono">
                {session.label}
              </span>

              {(ahead > 0 || behind > 0) && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-white/40">
                  {ahead > 0 && (
                    <span className="text-[var(--color-accent)]">+{ahead}</span>
                  )}
                  {behind > 0 && (
                    <span className="text-white/40">−{behind}</span>
                  )}
                </span>
              )}

              <span
                aria-hidden="true"
                className="flex shrink-0 items-center justify-center"
              >
                {gitStateIcon}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{tooltipText}</TooltipContent>
        </Tooltip>
        {isActive && onCreateThread && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onCreateThread(session.id)}
                aria-label="New thread"
                className="flex size-6 shrink-0 items-center justify-center text-white/50 transition-colors duration-150 hover:text-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <Plus aria-hidden="true" className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">New thread</TooltipContent>
          </Tooltip>
        )}
      </div>

      {session.threads.length > 0 && (
        <div className="relative ml-5 pl-4">
          <TreeConnector
            count={session.threads.length}
            rowHeight={28}
            startY={14}
            indent={16}
          />

          <div>
            {session.threads.map((thread) => {
              const isThreadActive = thread.id === activeThreadId;
              const isThreadStreaming =
                thread.runtime.status === "streaming" ||
                (isThreadActive && Boolean(isPromptExecuting));
              const threadIndicatorState: IndicatorState = isThreadStreaming
                ? "streaming"
                : !isThreadActive &&
                    thread.lastActivityAt !== null &&
                    thread.lastActivityAt >
                      (threadLastViewedAt?.[thread.id] ?? 0)
                  ? "unread"
                  : "idle";

              return (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  repositoryName={repositoryName}
                  worktreeName={session.label}
                  isActive={isThreadActive}
                  indicatorState={threadIndicatorState}
                  onSelect={onSelectThread}
                  onContextMenu={onThreadContextMenu}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const WorktreeRow = React.memo(WorktreeRowImpl);
