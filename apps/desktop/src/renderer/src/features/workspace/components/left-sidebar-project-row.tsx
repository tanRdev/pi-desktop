import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@pi-desktop/ui";
import * as React from "react";
import { Folder, Plus } from "@/components/ui/phosphor-icons";
import { getRepositoryName } from "./left-sidebar-tree-types";

export interface ProjectRowProps {
  repository: RepositorySnapshot;
  isActive: boolean;
  isExpanded: boolean;
  sessionCount: number;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, repo: RepositorySnapshot) => void;
  onCreateSession?: () => void | Promise<void>;
  isCreatingSession?: boolean;
}

function ProjectRowImpl({
  repository,
  isActive,
  isExpanded,
  sessionCount: _sessionCount,
  onSelect,
  onContextMenu,
  onCreateSession,
  isCreatingSession,
}: ProjectRowProps) {
  return (
    <div
      data-testid="workspace-row"
      onContextMenu={(e) => onContextMenu(e, repository)}
      className="flex w-full items-center"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(repository.id)}
            className={cn(
              "group flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left",
              "transition-colors duration-150",
              isActive
                ? "text-white"
                : "text-white/60 hover:text-white/80 hover:bg-white/[0.01]",
            )}
          >
            <Folder
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 transition-colors duration-150",
                isActive
                  ? "text-white/70"
                  : "text-white/50 group-hover:text-white/55",
              )}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[13px] font-medium",
                isActive && "text-white",
              )}
            >
              {getRepositoryName(repository)}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {getRepositoryName(repository)}
        </TooltipContent>
      </Tooltip>

      <div className="flex shrink-0 items-center gap-1 pr-[7px]">
        {isActive && isExpanded && onCreateSession && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  void onCreateSession();
                }}
                disabled={isCreatingSession}
                aria-label="New branch"
                data-testid="create-session-button"
                className="flex size-6 items-center justify-center text-white/50 transition-colors duration-150 hover:text-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <Plus aria-hidden="true" className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">New branch</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export const ProjectRow = React.memo(ProjectRowImpl);
