import type { WorktreeSnapshot } from "@pi-desktop/shared";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@pi-desktop/ui";
import * as React from "react";
import { Chat } from "@/components/ui/phosphor-icons";
import { StatusIndicator } from "./left-sidebar-tree-indicators";
import {
  type IndicatorState,
  passiveIndicatorState,
  type ThreadContextMenuHandler,
} from "./left-sidebar-tree-types";

export interface ThreadRowProps {
  thread: WorktreeSnapshot["threads"][number];
  repositoryName: string;
  worktreeName: string;
  isActive: boolean;
  indicatorState: IndicatorState;
  onSelect: (id: string) => void;
  onContextMenu?: ThreadContextMenuHandler;
}

function ThreadRowImpl({
  thread,
  repositoryName,
  worktreeName,
  isActive,
  indicatorState,
  onSelect,
  onContextMenu,
}: ThreadRowProps) {
  const threadTitle = thread.title.trim() || "Untitled thread";
  const tooltipText = `${repositoryName} › ${worktreeName} › ${threadTitle}`;
  const resolvedState = isActive
    ? indicatorState
    : passiveIndicatorState(indicatorState);

  return (
    <div data-testid="thread-row">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(thread.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu?.(e, thread.id, threadTitle);
            }}
            className={cn(
              "group flex w-full min-w-0 items-center gap-2 pl-[11px] pr-2 py-1.5 text-left text-[12px]",
              "transition-colors duration-150",
              isActive
                ? "text-white"
                : "text-white/40 hover:bg-white/[0.06] hover:text-white/65",
            )}
          >
            <Chat
              aria-hidden="true"
              weight="regular"
              className={cn(
                "size-3 shrink-0 transition-colors duration-150",
                isActive
                  ? "text-white/60"
                  : "text-white/50 group-hover:text-white/45",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{threadTitle}</span>
            {resolvedState !== "idle" && (
              <StatusIndicator state={resolvedState} />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{tooltipText}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export const ThreadRow = React.memo(ThreadRowImpl);
