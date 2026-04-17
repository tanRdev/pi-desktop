import type { RepositorySnapshot, WorktreeSnapshot } from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import {
  Copy,
  FolderPlus,
  Plus,
  SidebarSimple,
  Trash,
} from "@/components/ui/icons";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Sidebar width for minimalist layout
export const SIDEBAR_WIDTH = 260;

function formatTimePassed(timestamp: number | undefined | null): string {
  if (!timestamp) return "now";
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours}h`;
  return `${days}d`;
}

function getRepositoryName(repository: RepositorySnapshot): string {
  return repository.customName?.trim() || repository.name;
}

export interface LeftSidebarProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  isPromptExecuting?: boolean;
  isLoading?: boolean;
  width: number;
  onResize: (width: number) => void;
  onSelectRepository: (repositoryId: string) => void;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onDeleteWorktree?: (worktreeId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onAddRepository: () => void;
  onToggleVisible?: () => void;
  onOpenFilter?: () => void;
  onNewAgent?: () => void;
  onRemoveRepository?: (repositoryId: string) => void;
  onCopyRepositoryPath?: (repositoryId: string) => void;
  onOpenInFinder?: (repositoryId: string) => void;
  onCreateSession: () => void | Promise<void>;
}

// Git state colors - using CSS vars for theming
const GIT_COLORS = {
  active: "var(--color-accent)",
  ahead: "var(--color-success)",
  behind: "var(--color-error)",
  diverged: "var(--color-warning)",
  clean: "var(--color-text-tertiary)",
};

interface WorktreeRowProps {
  session: WorktreeSnapshot;
  isActive: boolean;
  isWorking: boolean;
  onSelect: (id: string) => void;
}

function WorktreeRowImpl({
  session,
  isActive,
  isWorking,
  onSelect,
}: WorktreeRowProps) {
  const ahead = session.git.ahead ?? 0;
  const behind = session.git.behind ?? 0;
  const isDirty = session.git.hasChanges ?? false;
  const hasChanges = ahead > 0 || behind > 0 || isDirty;

  // Determine state color
  let stateColor = GIT_COLORS.clean;
  if (isActive) {
    stateColor = GIT_COLORS.active;
  } else if (ahead > 0 && behind > 0) {
    stateColor = GIT_COLORS.diverged;
  } else if (ahead > 0) {
    stateColor = GIT_COLORS.ahead;
  } else if (behind > 0) {
    stateColor = GIT_COLORS.behind;
  } else if (isDirty) {
    stateColor = GIT_COLORS.ahead;
  }

  // Use createdAt or fall back to earliest thread creation time
  let startedAt: number | undefined = session.createdAt;
  if (!startedAt && session.threads.length > 0) {
    startedAt = session.threads.reduce(
      (oldest, t) => {
        if (!oldest) return t.createdAt ?? undefined;
        if (!t.createdAt) return oldest;
        return Math.min(oldest, t.createdAt);
      },
      undefined as number | undefined,
    );
  }

  return (
    <div data-testid="session-row">
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        className={cn(
          "group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150",
          isActive
            ? "bg-white/[0.04] text-white"
            : "text-white/50 hover:bg-white/[0.02] hover:text-white/70",
        )}
      >
        {/* Status indicator - simple square with animation for changes */}
        <div
          className={cn(
            "relative flex items-center justify-center transition-all duration-200",
            hasChanges && !isActive && "animate-pulse",
          )}
          style={{
            width: "6px",
            height: "6px",
            backgroundColor: stateColor,
            opacity: isActive ? 1 : hasChanges ? 0.8 : 0.4,
          }}
        >
          {/* Working indicator */}
          {isWorking && (
            <span
              className="absolute -inset-1 animate-ping"
              style={{
                backgroundColor: stateColor,
                opacity: 0.3,
              }}
            />
          )}
        </div>

        {/* Branch name */}
        <span
          className={cn(
            "flex-1 truncate text-[13px] transition-colors duration-150",
            isActive ? "font-medium" : "",
          )}
        >
          {session.label}
        </span>

        {/* Diff stats inline */}
        {hasChanges && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            {ahead > 0 && (
              <span style={{ color: "var(--color-success)" }}>+{ahead}</span>
            )}
            {behind > 0 && (
              <span style={{ color: "var(--color-error)" }}>−{behind}</span>
            )}
            {isDirty && ahead === 0 && behind === 0 && (
              <span className="text-white/30">*</span>
            )}
          </div>
        )}

        {/* Time indicator */}
        <span className="text-[10px] text-white/25 whitespace-nowrap">
          {formatTimePassed(startedAt)}
        </span>
      </button>
    </div>
  );
}

const WorktreeRow = React.memo(WorktreeRowImpl);

interface ProjectRowProps {
  repository: RepositorySnapshot;
  isActive: boolean;
  isExpanded: boolean;
  sessionCount: number;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, repo: RepositorySnapshot) => void;
}

function ProjectRowImpl({
  repository,
  isActive,
  isExpanded,
  sessionCount,
  onSelect,
  onContextMenu,
}: ProjectRowProps) {
  return (
    <div data-testid="workspace-row">
      <button
        type="button"
        onClick={() => onSelect(repository.id)}
        onContextMenu={(e) => onContextMenu(e, repository)}
        className={cn(
          "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150",
          isActive
            ? "bg-white/[0.04] text-white"
            : "text-white/60 hover:bg-white/[0.02] hover:text-white/80",
        )}
      >
        {/* Expand chevron - simple square shape */}
        <div
          className={cn(
            "flex items-center justify-center transition-all duration-200",
            isActive ? "text-white" : "text-white/40 group-hover:text-white/60",
          )}
          style={{ width: "14px", height: "14px" }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            className={cn(
              "transition-transform duration-200",
              isExpanded ? "rotate-90" : "rotate-0",
            )}
          >
            <path
              d="M3 2L7 5L3 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Project name */}
        <span
          className={cn(
            "flex-1 truncate text-[13px] transition-colors duration-150",
            isActive ? "font-medium" : "",
          )}
        >
          {getRepositoryName(repository)}
        </span>

        {/* Session count - simple square badge */}
        {sessionCount > 0 && (
          <span
            className={cn(
              "flex items-center justify-center px-1.5 text-[10px] font-medium transition-colors duration-150",
              isActive ? "text-white/60" : "text-white/30",
            )}
            style={{
              backgroundColor: isActive
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(255, 255, 255, 0.04)",
              minWidth: "18px",
              height: "18px",
            }}
          >
            {sessionCount}
          </span>
        )}
      </button>
    </div>
  );
}

const ProjectRow = React.memo(ProjectRowImpl);

export function LeftSidebarImpl({
  repositories,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId: _activeThreadId,
  isPromptExecuting,
  isLoading,
  width,
  onResize,
  onSelectRepository,
  onSelectWorktree,
  onSelectThread: _onSelectThread,
  onDeleteThread: _onDeleteThread,
  onDeleteWorktree: _onDeleteWorktree,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onCreateSession,
  onAddRepository,
  onToggleVisible,
}: LeftSidebarProps) {
  const [isResizing, setIsResizing] = React.useState(false);
  const asideRef = React.useRef<HTMLElement | null>(null);
  const liveWidthRef = React.useRef<number>(width);

  React.useEffect(() => {
    liveWidthRef.current = width;
  }, [width]);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    isOpen: boolean;
    x: number;
    y: number;
    repositoryId: string | null;
    repositoryName: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    repositoryId: null,
    repositoryName: "",
  });

  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);

  const [expandedRepositoryIds, setExpandedRepositoryIds] = React.useState<
    Set<string>
  >(() => (activeRepositoryId ? new Set([activeRepositoryId]) : new Set()));

  React.useEffect(() => {
    setExpandedRepositoryIds((current) => {
      const next = new Set(
        Array.from(current).filter((repositoryId) =>
          repositories.some((repository) => repository.id === repositoryId),
        ),
      );

      if (activeRepositoryId) {
        next.add(activeRepositoryId);
      }

      return next;
    });
  }, [activeRepositoryId, repositories]);

  React.useEffect(() => {
    if (!isResizing) return;

    const applyLiveWidth = (w: number) => {
      liveWidthRef.current = w;
      const aside = asideRef.current;
      if (aside) {
        aside.style.width = `${w}px`;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(400, e.clientX));
      applyLiveWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onResize(liveWidthRef.current);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onResize]);

  // Close context menu on click outside
  React.useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu.isOpen]);

  const handleCreateSession = React.useCallback(async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      await onCreateSession();
    } finally {
      setIsCreatingSession(false);
    }
  }, [isCreatingSession, onCreateSession]);

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent, repository: RepositorySnapshot) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        repositoryId: repository.id,
        repositoryName: getRepositoryName(repository),
      });
    },
    [],
  );

  const handleMenuAction = React.useCallback((action: () => void) => {
    action();
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleSelectProject = React.useCallback(
    (repositoryId: string) => {
      const isActive = repositoryId === activeRepositoryId;
      const isExpanded = expandedRepositoryIds.has(repositoryId);

      setExpandedRepositoryIds((current) => {
        if (isActive && isExpanded) {
          const next = new Set(current);
          next.delete(repositoryId);
          return next;
        }
        return new Set([repositoryId]);
      });

      if (!isActive) {
        onSelectRepository(repositoryId);
      }
    },
    [activeRepositoryId, expandedRepositoryIds, onSelectRepository],
  );

  const contextMenuRepositoryId = contextMenu.repositoryId;

  return (
    <aside
      ref={asideRef}
      data-testid="left-sidebar"
      className="relative z-20 flex h-full shrink-0 select-none flex-col bg-[var(--color-bg-primary)] border-r border-white/[0.06]"
      style={{ width }}
    >
      {/* Header */}
      <div
        data-drag-region="true"
        className="flex h-11 w-full shrink-0 items-center justify-end px-3"
      >
        <button
          type="button"
          onClick={onToggleVisible}
          data-no-drag="true"
          className="flex size-8 items-center justify-center text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60"
        >
          <SidebarSimple className="size-5" />
        </button>
      </div>

      {/* Repository List */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {/* Projects header */}
        <div className="px-4 py-2 flex items-center justify-between group">
          <div className="text-[11px] text-white/40 font-medium uppercase tracking-wider">
            Projects
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onAddRepository}
                className="flex size-8 items-center justify-center text-white/40 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/80"
              >
                <FolderPlus className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Open project folder</TooltipContent>
          </Tooltip>
        </div>

        {/* Projects */}
        <div className="space-y-0.5">
          {repositories.map((repository) => {
            const isActiveRepo = repository.id === activeRepositoryId;
            const isExpanded = expandedRepositoryIds.has(repository.id);
            const sessions = repository.worktrees;

            return (
              <div key={repository.id}>
                <ProjectRow
                  repository={repository}
                  isActive={isActiveRepo}
                  isExpanded={isExpanded}
                  sessionCount={sessions.length}
                  onSelect={handleSelectProject}
                  onContextMenu={handleContextMenu}
                />

                {isExpanded && (
                  <div className="border-l border-white/[0.04] ml-5">
                    <Skeleton
                      name="session-list"
                      loading={Boolean(isLoading && isActiveRepo)}
                      fixture={[1, 2].map((i) => (
                        <div key={i} className="h-10" />
                      ))}
                    >
                      <div>
                        {sessions.map((session) => {
                          const isSessionActive =
                            session.id === activeWorktreeId;
                          const isSessionWorking =
                            session.threads.some(
                              (thread) => thread.runtime.status === "streaming",
                            ) ||
                            (isSessionActive && Boolean(isPromptExecuting));

                          return (
                            <WorktreeRow
                              key={session.id}
                              session={session}
                              isActive={isSessionActive}
                              isWorking={isSessionWorking}
                              onSelect={onSelectWorktree}
                            />
                          );
                        })}
                      </div>
                    </Skeleton>

                    {/* New branch button - aligned with worktree rows */}
                    {isActiveRepo && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={handleCreateSession}
                            disabled={isCreatingSession}
                            className="flex w-full items-center gap-3 px-3 py-2 text-[13px] text-white/30 transition-colors duration-150 hover:text-white/60"
                          >
                            <div className="w-[6px] h-[6px] bg-transparent" />
                            <Plus className="size-3.5 text-white/40" />
                            <span>New branch</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          Create new branch
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resize handle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors duration-300",
              "bg-transparent hover:bg-white/10",
              isResizing && "bg-white/20",
            )}
            onMouseDown={() => setIsResizing(true)}
          />
        </TooltipTrigger>
        <TooltipContent side="right">Drag to resize</TooltipContent>
      </Tooltip>

      {/* Context Menu */}
      {contextMenu.isOpen && contextMenuRepositoryId !== null && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[160px] border border-white/[0.06] bg-[var(--color-bg-primary)] p-0 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <span className="block truncate text-[12px] text-white/60">
              {contextMenu.repositoryName}
            </span>
          </div>
          {onCopyRepositoryPath && (
            <button
              type="button"
              onClick={() =>
                handleMenuAction(() =>
                  onCopyRepositoryPath(contextMenuRepositoryId),
                )
              }
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.04] transition-colors duration-150"
            >
              <Copy className="size-4" />
              Copy path
            </button>
          )}
          {onOpenInFinder && (
            <button
              type="button"
              onClick={() =>
                handleMenuAction(() => onOpenInFinder(contextMenuRepositoryId))
              }
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.04] transition-colors duration-150"
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <title>Open</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                />
              </svg>
              Open in Finder
            </button>
          )}
          {onRemoveRepository && (
            <>
              <div className="my-1 border-t border-white/[0.06]" />
              <button
                type="button"
                onClick={() =>
                  handleMenuAction(() =>
                    onRemoveRepository(contextMenuRepositoryId),
                  )
                }
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
              >
                <Trash className="size-4" />
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

export const LeftSidebar = React.memo(LeftSidebarImpl);
