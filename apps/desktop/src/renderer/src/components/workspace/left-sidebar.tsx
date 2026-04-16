import type { RepositorySnapshot, WorktreeSnapshot } from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import {
  CaretDown,
  CaretRight,
  Copy,
  Folder,
  FolderPlus,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Plus,
  SidebarSimple,
  Trash,
} from "@/components/ui/icons";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUnicodeSpinner } from "@/hooks/use-unicode-spinner";
import { cn } from "@/lib/utils";

// Sidebar width for minimalist layout

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

export const SIDEBAR_WIDTH = 240;

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
  onCreateSession: () => void | Promise<void>;
  onDeleteWorktree?: (worktreeId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onAddRepository: () => void;
  onToggleVisible?: () => void;
  onOpenFilter?: () => void;
  onNewAgent?: () => void;
  onRemoveRepository?: (repositoryId: string) => void;
  onCopyRepositoryPath?: (repositoryId: string) => void;
  onOpenInFinder?: (repositoryId: string) => void;
}

function getRepositoryActiveSessions(
  repository: RepositorySnapshot,
): WorktreeSnapshot[] {
  return repository.worktrees;
}

interface ThreadCategorySectionProps {
  label: string;
  icon: React.ElementType;
  children?: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  actionTestId?: string;
}

function _ThreadCategorySection({
  label,
  icon: Icon,
  children,
  onAction,
  actionLabel,
  actionTestId,
}: ThreadCategorySectionProps) {
  return (
    <div className="relative space-y-0.5">
      <div
        className={cn(
          "flex w-full items-center justify-between px-2 py-2 text-[10.5px] text-white/50",
          "group/item",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
          <span className="flex size-5 shrink-0 items-center justify-center">
            <Icon className="size-5 text-white/40" />
          </span>
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center ml-2">
          {onAction && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction();
                  }}
                  data-testid={actionTestId}
                  className="hidden group-hover/item:flex size-5 items-center justify-center hover:bg-white/10 hover:text-white/80 transition-colors text-white/40"
                  aria-label={actionLabel}
                >
                  <Plus className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{actionLabel}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="pl-4">
        <div className="py-1 space-y-0.5">{children}</div>
      </div>
    </div>
  );
}

interface SessionRowProps {
  session: WorktreeSnapshot;
  isActive: boolean;
  isWorking?: boolean;
  onSelect: (id: string) => void;
}

function SessionRowImpl({
  session,
  isActive,
  isWorking = false,
  onSelect,
}: SessionRowProps) {
  const spinnerFrame = useUnicodeSpinner(
    { frames: ["⡇", "⠏", "⠹", "⠼", "⡸", "⣇"], interval: 150 },
    isWorking,
  );

  let Icon = GitBranch;
  if (session.git.prStatus === "merged") Icon = GitMerge;
  else if (session.git.prStatus === "open") Icon = GitPullRequest;

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
    <div data-testid="session-row" className="group/session relative">
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        className={cn(
          "group relative flex w-full items-center gap-2 px-2 py-2 text-left text-[10.5px] transition-colors",
          isActive
            ? "bg-[var(--color-accent-subtle)] text-[color:var(--text-dim-1)]"
            : "text-[color:var(--text-dim-3)] hover:bg-white/[0.04] hover:text-[color:var(--text-dim-1)]",
        )}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          {isWorking ? (
            <span className="text-[10.5px] leading-none text-[color:var(--color-accent)] font-mono whitespace-nowrap">
              {spinnerFrame}
            </span>
          ) : (
            <Icon
              className={cn(
                "size-3.5",
                isActive
                  ? "text-[color:var(--color-accent)]"
                  : "text-[color:var(--text-dim-3)]",
              )}
            />
          )}
        </span>
        <span className="truncate flex-1">{session.label}</span>
        <span className="flex size-5 items-center justify-center text-[10px] text-[color:var(--text-dim-4)] whitespace-nowrap">
          {formatTimePassed(startedAt)}
        </span>
        {isActive && (
          <span className="absolute top-1/2 left-0 h-[60%] w-[2px] -translate-y-1/2 rounded-full bg-[var(--color-accent)]" />
        )}
      </button>
    </div>
  );
}

export const SessionRow = React.memo(SessionRowImpl);

interface WorkspaceRowProps {
  repository: RepositorySnapshot;
  isActive: boolean;
  isExpanded: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (
    event: React.MouseEvent<HTMLButtonElement>,
    repository: RepositorySnapshot,
  ) => void;
}

function WorkspaceRowImpl({
  repository,
  isActive,
  isExpanded,
  onSelect,
  onContextMenu,
}: WorkspaceRowProps) {
  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onContextMenu(event, repository);
    },
    [onContextMenu, repository],
  );
  return (
    <div
      data-testid="workspace-row"
      className="group relative flex items-center gap-1"
    >
      <button
        type="button"
        onClick={() => onSelect(repository.id)}
        onContextMenu={handleContextMenu}
        className={cn(
          "group/row relative flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[10.5px] transition-colors",
          isActive
            ? "bg-[var(--color-accent-subtle)] text-[color:var(--text-dim-1)]"
            : "text-[color:var(--text-dim-2)] hover:bg-white/[0.04] hover:text-[color:var(--text-dim-1)]",
        )}
      >
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-0 h-[70%] w-[2px] -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
          />
        )}
        <span className="flex size-5 shrink-0 items-center justify-center">
          <Folder
            className={cn(
              "size-3.5",
              isActive
                ? "text-[color:var(--color-accent)]"
                : "text-[color:var(--text-dim-3)]",
            )}
          />
        </span>
        <span className="truncate flex-1">{getRepositoryName(repository)}</span>
        <span className="flex size-4 shrink-0 items-center justify-center text-[color:var(--text-dim-3)]">
          {isExpanded ? (
            <CaretDown className="size-3.5" />
          ) : (
            <CaretRight className="size-3.5" />
          )}
        </span>
      </button>
    </div>
  );
}

const WorkspaceRow = React.memo(WorkspaceRowImpl);

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
  // Thread/worktree delete wiring was removed during the shell refactor but the
  // prop contract is still part of the public LeftSidebar API (callers + specs).
  // Rename to _-prefixed locals so biome treats them as intentionally unused
  // without breaking the component's prop surface.
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

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(360, e.clientX));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
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
    if (isCreatingSession) {
      return;
    }

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

  const handleSelectWorkspace = React.useCallback(
    (repositoryId: string) => {
      const isActiveRepository = repositoryId === activeRepositoryId;
      const isExpanded = expandedRepositoryIds.has(repositoryId);

      setExpandedRepositoryIds((current) => {
        if (isActiveRepository && isExpanded) {
          const next = new Set(current);
          next.delete(repositoryId);
          return next;
        }

        return new Set([repositoryId]);
      });

      if (!isActiveRepository) {
        onSelectRepository(repositoryId);
      }
    },
    [activeRepositoryId, expandedRepositoryIds, onSelectRepository],
  );

  const contextMenuRepositoryId = contextMenu.repositoryId;

  return (
    <aside
      data-testid="left-sidebar"
      data-mode="workspace"
      className={cn(
        "relative z-20 flex h-full shrink-0 select-none flex-col",
        // Minimalist: Clean dark surface with subtle border
        "bg-[var(--color-bg-primary)]",
        "border-r border-white/[0.06]",
      )}
      style={{ width }}
    >
      {/* Drag region for macOS traffic lights */}
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
        {/* Projects header with clear action */}
        <div className="px-3 py-2 flex items-center justify-between group">
          <div className="text-[10.5px] text-white/40 font-normal uppercase tracking-wider truncate mr-2">
            Projects
          </div>
          <div className="flex gap-1 shrink-0">
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
        </div>

        <div className="space-y-0.5 px-2">
          {repositories.map((repository) => {
            const isActiveRepository = repository.id === activeRepositoryId;
            const isExpanded = expandedRepositoryIds.has(repository.id);
            const sessions = getRepositoryActiveSessions(repository);

            return (
              <div key={repository.id} className="space-y-1.5">
                <WorkspaceRow
                  repository={repository}
                  isActive={isActiveRepository}
                  isExpanded={isExpanded}
                  onSelect={handleSelectWorkspace}
                  onContextMenu={handleContextMenu}
                />

                {isExpanded ? (
                  <div className="space-y-1.5 pl-4">
                    <Skeleton
                      name="session-list"
                      loading={Boolean(isLoading && isActiveRepository)}
                      fixture={[1, 2, 3].map((i) => (
                        <SessionRow
                          key={i}
                          session={{
                            id: String(i),
                            label: "Loading session...",
                            path: "",
                            isMain: false,
                            isDetached: false,
                            threads: [],
                            git: {
                              status: "ready",
                              branch: null,
                              commit: null,
                              hasChanges: false,
                              ahead: null,
                              behind: null,
                              stagedCount: 0,
                              modifiedCount: 0,
                              untrackedCount: 0,
                              message: null,
                            },
                          }}
                          isActive={false}
                          onSelect={() => {}}
                        />
                      ))}
                    >
                      <div className="space-y-0.5">
                        {sessions.map((session) => {
                          const isSessionActive =
                            session.id === activeWorktreeId;
                          const isSessionWorking =
                            session.threads.some(
                              (thread) => thread.runtime.status === "streaming",
                            ) ||
                            (isSessionActive && Boolean(isPromptExecuting));

                          return (
                            <SessionRow
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
                    {isActiveRepository ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            data-testid="create-session-button"
                            onClick={handleCreateSession}
                            className="flex w-full items-center gap-2 px-2 py-2 text-[10.5px] text-[color:var(--text-dim-3)] transition-colors hover:bg-white/[0.04] hover:text-[color:var(--text-dim-1)]"
                            aria-label="Create new branch"
                          >
                            <Plus className="size-3.5" />
                            <span>New branch</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          Create new branch
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                ) : null}
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
              "absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize",
              "transition-colors duration-[var(--duration-normal)]",
              "bg-transparent hover:bg-[var(--color-border-strong)]",
              isResizing && "bg-[var(--color-text-muted)]",
            )}
            onMouseDown={() => setIsResizing(true)}
            role="presentation"
            aria-hidden="true"
          />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          Drag to resize
        </TooltipContent>
      </Tooltip>

      {/* Context Menu */}
      {contextMenu.isOpen && contextMenuRepositoryId !== null ? (
        <div
          ref={contextMenuRef}
          className={cn(
            "fixed z-[100] min-w-[160px] border border-white/[0.06] bg-[var(--color-bg-primary)] p-1 backdrop-blur-md",
            "shadow-[var(--shadow-hover)]",
            "animate-in fade-in-0 zoom-in-[0.98] duration-150 ease-out",
          )}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-2 py-1.5">
            <span className="block truncate text-[10.5px] text-[var(--color-text-secondary)]">
              {contextMenu.repositoryName}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onCopyRepositoryPath?.(contextMenuRepositoryId),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[10.5px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Copy className="size-2.5" />
            <span>Copy project path</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() => onOpenInFinder?.(contextMenuRepositoryId))
            }
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[10.5px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Folder className="size-2.5" />
            <span>Show in Finder</span>
          </button>
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onRemoveRepository?.(contextMenuRepositoryId),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[10.5px] text-[var(--accent-pale-red-text)]",
              "transition-colors duration-100",
              "hover:bg-[var(--accent-pale-red-bg)]",
            )}
          >
            <Trash className="size-2.5" />
            <span>Remove from Pi</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}

export const LeftSidebar = React.memo(LeftSidebarImpl);
