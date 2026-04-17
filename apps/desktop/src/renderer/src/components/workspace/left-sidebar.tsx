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

export const SIDEBAR_WIDTH = 260;

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

// Branch connector SVG that connects project to worktree status indicators
function BranchConnector({
  count,
  isExpanded,
}: {
  count: number;
  isExpanded: boolean;
}) {
  if (count === 0 || !isExpanded) return null;

  const rowHeight = 36; // Approximate height of each worktree row
  const startY = 18; // Center of first row
  const indent = 20; // Horizontal indent from project

  return (
    <svg
      className="absolute pointer-events-none"
      aria-hidden="true"
      style={{
        left: 0,
        top: 0,
        width: indent + 6,
        height: count * rowHeight,
        overflow: "visible",
      }}
    >
      {/* Vertical stem from project */}
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={count * rowHeight - startY}
        stroke="rgba(255, 255, 255, 0.06)"
        strokeWidth={1}
      />

      {/* Horizontal branches to each worktree indicator */}
      {Array.from({ length: count }).map((_, i) => {
        const y = startY + i * rowHeight;
        return (
          <g key={i}>
            {/* Horizontal line to status indicator */}
            <line
              x1={0}
              y1={y}
              x2={indent - 2}
              y2={y}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth={1}
            />
            {/* Small vertical connector at the end */}
            <line
              x1={indent - 2}
              y1={y}
              x2={indent + 4}
              y2={y}
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </svg>
  );
}

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

  return (
    <div data-testid="session-row">
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        className={cn(
          "group flex w-full items-center gap-3 px-3 py-2 text-left text-[13px]",
          "transition-colors duration-150",
          isActive
            ? "text-white"
            : "text-white/50 hover:text-white/70 hover:bg-white/[0.01]",
        )}
      >
        {/* Status indicator - connected by branch line */}
        <div
          className={cn(
            "w-1.5 h-1.5 flex-shrink-0 transition-all duration-200",
            isActive && "bg-[var(--color-accent)] scale-110",
            !isActive && hasChanges && "bg-white/40",
            !isActive && !hasChanges && "bg-white/20",
          )}
        >
          {isWorking && (
            <span className="block w-full h-full bg-white/60 animate-pulse" />
          )}
        </div>

        {/* Branch name */}
        <span className="flex-1 truncate font-mono">{session.label}</span>

        {/* Diff stats - connected square pill */}
        {(ahead > 0 || behind > 0) && (
          <div
            className="flex text-[10px] font-mono"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            {ahead > 0 && (
              <span
                className="px-1.5 py-0.5 border-r border-white/[0.06]"
                style={{ color: "#5fb87a" }}
              >
                +{ahead}
              </span>
            )}
            {behind > 0 && (
              <span className="px-1.5 py-0.5" style={{ color: "#d95f5f" }}>
                −{behind}
              </span>
            )}
          </div>
        )}
        {isDirty && ahead === 0 && behind === 0 && (
          <span className="text-[10px] text-white/30 font-mono">*</span>
        )}
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
  onCreateSession?: () => void;
  isCreatingSession?: boolean;
}

function ProjectRowImpl({
  repository,
  isActive,
  isExpanded,
  sessionCount,
  onSelect,
  onContextMenu,
  onCreateSession,
  isCreatingSession,
}: ProjectRowProps) {
  return (
    <div data-testid="workspace-row">
      <button
        type="button"
        onClick={() => onSelect(repository.id)}
        onContextMenu={(e) => onContextMenu(e, repository)}
        className={cn(
          "group flex w-full items-center gap-3 px-3 py-2.5 text-left",
          "transition-colors duration-150",
          isActive
            ? "text-white"
            : "text-white/60 hover:text-white/80 hover:bg-white/[0.01]",
        )}
      >
        {/* Expand indicator - minimal square */}
        <div
          className={cn(
            "flex items-center justify-center text-white/30",
            "transition-all duration-150",
            isExpanded && "text-white/50",
          )}
          style={{ width: "14px", height: "14px" }}
        >
          <div
            className={cn(
              "w-2 h-2 transition-all duration-150",
              isExpanded ? "bg-white/50 rotate-0" : "bg-white/30 rotate-0",
            )}
          />
        </div>

        {/* Project name */}
        <span
          className={cn(
            "flex-1 truncate text-[13px] font-medium",
            isActive && "text-white",
          )}
        >
          {getRepositoryName(repository)}
        </span>

        {/* New branch icon - appears when active and expanded */}
        {isActive && isExpanded && onCreateSession && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateSession();
                }}
                disabled={isCreatingSession}
                data-testid="create-session-button"
                className="flex size-6 items-center justify-center text-white/30 transition-colors duration-150 hover:text-white/60"
              >
                <Plus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">New branch</TooltipContent>
          </Tooltip>
        )}

        {/* Session count */}
        {sessionCount > 0 && (
          <span className="text-[10px] text-white/30 font-mono">
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
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="text-[11px] text-white/40 font-medium uppercase tracking-wider">
            Projects
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onAddRepository}
                aria-label="Open project folder"
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
                  onCreateSession={handleCreateSession}
                  isCreatingSession={isCreatingSession}
                />

                {isExpanded && (
                  <div className="relative ml-5 pl-5">
                    {/* Branch connector that connects to status indicators */}
                    <BranchConnector
                      count={sessions.length}
                      isExpanded={isExpanded}
                    />

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
