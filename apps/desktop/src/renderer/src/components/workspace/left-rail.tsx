import type {
  RepositorySnapshot,
  ThreadSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import {
  Archive,
  CaretDown,
  CaretRight,
  Copy,
  Folder,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Plus,
  SidebarSimple,
  Trash,
} from "@/components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUnicodeSpinner } from "@/hooks/use-unicode-spinner";
import { cn } from "@/lib/utils";
import { DEFAULT_UNTITLED_THREAD_TITLE } from "../../../../thread-title-defaults";
import { RepositorySwitcher } from "./repository-switcher";

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

export interface LeftRailProps {
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
  onArchiveSession?: (worktreeId: string) => void;
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
  const sessions: WorktreeSnapshot[] = [];

  for (const worktree of repository.worktrees) {
    const openThreads = worktree.threads.filter((thread) => !thread.isArchived);
    const worktreeArchivedThreads = worktree.threads.filter(
      (thread) => thread.isArchived,
    );

    // Only show worktrees that have at least one non-archived thread
    if (openThreads.length === 0 && worktreeArchivedThreads.length > 0) {
      continue;
    }

    sessions.push(worktree);
  }

  return sessions;
}

interface GlobalArchivedItem {
  type: "session" | "thread";
  id: string;
  title: string;
  repositoryId: string;
  repositoryName: string;
  worktreeId: string;
  // For sessions
  session?: WorktreeSnapshot;
  // For threads
  thread?: ThreadSnapshot;
}

function getGlobalArchivedItems(
  repositories: RepositorySnapshot[],
): GlobalArchivedItem[] {
  const items: GlobalArchivedItem[] = [];

  for (const repository of repositories) {
    for (const worktree of repository.worktrees) {
      // Check if this worktree is fully archived (all threads archived)
      const openThreads = worktree.threads.filter(
        (thread) => !thread.isArchived,
      );
      const archivedThreads = worktree.threads.filter(
        (thread) => thread.isArchived,
      );

      if (openThreads.length === 0 && archivedThreads.length > 0) {
        // Fully archived session
        items.push({
          type: "session",
          id: worktree.id,
          title: worktree.label,
          repositoryId: repository.id,
          repositoryName:
            repository.customName?.trim() || repository.name || "Unknown",
          worktreeId: worktree.id,
          session: worktree,
        });
      } else {
        // Individual archived threads from active sessions
        for (const thread of archivedThreads) {
          items.push({
            type: "thread",
            id: thread.id,
            title: thread.title || "Untitled thread",
            repositoryId: repository.id,
            repositoryName:
              repository.customName?.trim() || repository.name || "Unknown",
            worktreeId: worktree.id,
            thread,
          });
        }
      }
    }
  }

  return items;
}

interface ThreadCategorySectionProps {
  label: string;
  icon: React.ElementType;
  children?: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  actionTestId?: string;
}

function ThreadCategorySection({
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
          "flex w-full items-center justify-between rounded px-2 py-2 text-[13px] text-white/50",
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
                  className="hidden group-hover/item:flex size-5 items-center justify-center rounded hover:bg-white/10 hover:text-white/80 transition-colors text-white/40"
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

export function SessionRow({
  session,
  isActive,
  isWorking = false,
  onSelect,
  onArchive,
}: {
  session: WorktreeSnapshot;
  isActive: boolean;
  isWorking?: boolean;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
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
          "group relative flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-[13px] transition-colors",
          onArchive ? "pr-8" : undefined,
          isActive
            ? "bg-transparent text-white/80"
            : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
        )}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          {isWorking ? (
            <span className="text-[14px] leading-none text-white font-mono whitespace-nowrap">
              {spinnerFrame}
            </span>
          ) : (
            <Icon className="size-2.5 text-white/40" />
          )}
        </span>
        <span className="truncate flex-1">{session.label}</span>
        <span
          className={cn(
            "text-[10px] text-white/30 whitespace-nowrap",
            onArchive ? "pr-6" : "pr-2",
          )}
        >
          {formatTimePassed(startedAt)}
        </span>
        {isActive && (
          <span
            className={cn(
              "absolute top-1/2 h-[60%] w-[2px] -translate-y-1/2 rounded-full bg-white/80",
              onArchive ? "left-0" : "left-0",
            )}
          />
        )}
      </button>
      {onArchive ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="archive-session-button"
              onClick={(event) => {
                event.stopPropagation();
                onArchive(session.id);
              }}
              className={cn(
                "absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-white/35 opacity-0 transition-all duration-[var(--duration-fast)]",
                "hover:bg-white/[0.08] hover:text-white/80",
                "group-hover/session:opacity-100 focus-visible:opacity-100",
              )}
              aria-label={`Archive session ${session.label}`}
            >
              <Archive className="size-2.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Archive session</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function WorkspaceRow({
  repository,
  isActive,
  isExpanded,
  onSelect,
  onCreateSession,
  onContextMenu,
}: {
  repository: RepositorySnapshot;
  isActive: boolean;
  isExpanded: boolean;
  onSelect: (id: string) => void;
  onCreateSession?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      data-testid="workspace-row"
      className="group relative flex items-center gap-1"
    >
      <button
        type="button"
        onClick={() => onSelect(repository.id)}
        onContextMenu={onContextMenu}
        className={cn(
          "group/row relative flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-2 text-left text-[13px] transition-colors",
          isActive
            ? "bg-transparent text-white/80"
            : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
        )}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          <Folder className="size-2.5 text-white/35" />
        </span>
        <span className="truncate flex-1">{getRepositoryName(repository)}</span>
        <span className="flex size-4 shrink-0 items-center justify-center text-white/25">
          {isExpanded ? (
            <CaretDown className="size-2.5" />
          ) : (
            <CaretRight className="size-2.5" />
          )}
        </span>
      </button>
      {onCreateSession ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="create-session-button"
              onClick={onCreateSession}
              className="flex size-5 shrink-0 items-center justify-center rounded text-white/35 opacity-0 transition-all duration-[var(--duration-fast)] hover:bg-white/[0.08] hover:text-white/80 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label="Create session"
            >
              <Plus className="size-2.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Create session</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

export function LeftRail({
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
  onSelectThread,
  onDeleteThread,
  onDeleteWorktree,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onCreateSession,
  onArchiveSession,
  onAddRepository,
  onToggleVisible,
}: LeftRailProps) {
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
  const [pendingDeleteThreadId, setPendingDeleteThreadId] = React.useState<
    string | null
  >(null);
  const [pendingDeleteWorktreeId, setPendingDeleteWorktreeId] = React.useState<
    string | null
  >(null);
  const [pendingDeleteThreadIds, setPendingDeleteThreadIds] = React.useState(
    () => new Set<string>(),
  );
  const [pendingDeleteWorktreeIds, setPendingDeleteWorktreeIds] =
    React.useState(() => new Set<string>());

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

  const handleDeleteArchivedThread = React.useCallback(
    async (threadId: string) => {
      setPendingDeleteThreadIds((current) => {
        const next = new Set(current);
        next.add(threadId);
        return next;
      });

      try {
        await onDeleteThread?.(threadId);
      } finally {
        setPendingDeleteThreadIds((current) => {
          const next = new Set(current);
          next.delete(threadId);
          return next;
        });
      }
    },
    [onDeleteThread],
  );

  const handleDeleteArchivedWorktree = React.useCallback(
    async (worktreeId: string) => {
      setPendingDeleteWorktreeIds((current) => {
        const next = new Set(current);
        next.add(worktreeId);
        return next;
      });

      try {
        await onDeleteWorktree?.(worktreeId);
      } finally {
        setPendingDeleteWorktreeIds((current) => {
          const next = new Set(current);
          next.delete(worktreeId);
          return next;
        });
      }
    },
    [onDeleteWorktree],
  );

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
      data-testid="left-rail"
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
          className="flex size-8 items-center justify-center rounded-sm text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60"
        >
          <SidebarSimple className="size-5" />
        </button>
      </div>

      {/* Repository List */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="px-3 py-2 flex items-center justify-between group">
          <div className="text-[13px] text-white/40 font-semibold uppercase tracking-wider truncate mr-2">
            Pi Desktop
          </div>
          <div className="flex gap-1 shrink-0">
            <RepositorySwitcher
              repositories={repositories}
              activeRepositoryId={activeRepositoryId}
              onSelect={onSelectRepository}
              onAdd={onAddRepository}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onAddRepository}
                  aria-label="New workspace"
                  className="flex size-8 items-center justify-center rounded-sm text-white/40 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/80"
                >
                  <Folder className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">New workspace</TooltipContent>
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
                  onCreateSession={
                    isActiveRepository
                      ? () => {
                          void handleCreateSession();
                        }
                      : undefined
                  }
                  onContextMenu={(event) =>
                    handleContextMenu(event, repository)
                  }
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
                              onArchive={onArchiveSession}
                            />
                          );
                        })}
                      </div>
                    </Skeleton>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Global Archived Section */}
        {(() => {
          const archivedItems = getGlobalArchivedItems(repositories);
          if (archivedItems.length === 0) return null;

          return (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className="px-3 mb-2">
                <div className="flex items-center gap-2 text-[13px] text-white/40">
                  <Archive className="size-3.5" />
                  <span className="font-medium uppercase tracking-wider">
                    Archived
                  </span>
                </div>
              </div>
              <div className="px-2 space-y-0.5">
                {archivedItems.map((item) => {
                  if (item.type === "session") {
                    const session = item.session!;
                    const isDeleteConfirmationOpen =
                      pendingDeleteWorktreeId === session.id;
                    const isDeletingWorktree = pendingDeleteWorktreeIds.has(
                      session.id,
                    );

                    return (
                      <div
                        key={session.id}
                        data-testid="archived-session-row"
                        className={cn(
                          "group/archived-session flex w-full items-center gap-1 rounded-sm px-2 py-1 text-[13px] transition-colors",
                          "text-white/30 hover:bg-white/[0.04] hover:text-white/50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDeleteWorktreeId(null);
                            onSelectWorktree(session.id);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-0 py-1 text-left"
                        >
                          <Archive className="size-2.5 shrink-0 text-white/20" />
                          <span className="truncate flex-1">
                            {session.label}
                          </span>
                        </button>
                        {onDeleteWorktree ? (
                          <Popover
                            open={isDeleteConfirmationOpen}
                            onOpenChange={(open) =>
                              setPendingDeleteWorktreeId(
                                open ? session.id : null,
                              )
                            }
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                data-testid="archived-worktree-delete-button"
                                disabled={isDeletingWorktree}
                                title="Delete archived session"
                                className={cn(
                                  "ml-auto flex size-5 shrink-0 items-center justify-center rounded text-white/35 opacity-0 transition-all duration-[var(--duration-fast)]",
                                  "hover:bg-white/[0.08] hover:text-white/80",
                                  "group-hover/archived-session:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                                )}
                                aria-label="Delete archived session"
                              >
                                <Trash className="size-2.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              side="bottom"
                              className="w-auto min-w-[260px] rounded-md border border-white/[0.06] bg-[var(--color-bg-tertiary)] p-2 shadow-lg backdrop-blur-md"
                            >
                              <div className="space-y-2">
                                <p className="text-[13px] text-white/70">
                                  Permanently delete this worktree and all its
                                  data from disk?
                                </p>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isDeletingWorktree}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setPendingDeleteWorktreeId(null);
                                    }}
                                    className="rounded px-2 py-1 text-[13px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    data-testid="archived-worktree-delete-confirm"
                                    disabled={isDeletingWorktree}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setPendingDeleteWorktreeId(null);
                                      void handleDeleteArchivedWorktree(
                                        session.id,
                                      );
                                    }}
                                    className="rounded bg-white/[0.08] px-2 py-1 text-[13px] text-white/85 transition-colors hover:bg-white/[0.14]"
                                  >
                                    {isDeletingWorktree
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </div>
                    );
                  }

                  // Thread item
                  const thread = item.thread!;
                  const isDeleteConfirmationOpen =
                    pendingDeleteThreadId === thread.id;
                  const isDeletingThread = pendingDeleteThreadIds.has(
                    thread.id,
                  );

                  return (
                    <div
                      key={thread.id}
                      className={cn(
                        "group/archived flex w-full items-center gap-1 rounded-sm px-2 py-1 text-[13px] transition-colors",
                        "text-white/30 hover:bg-white/[0.04] hover:text-white/50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDeleteThreadId(null);
                          onSelectThread(thread.id);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-0 py-1 text-left"
                      >
                        <Archive className="size-2.5 shrink-0 text-white/20" />
                        <span className="truncate flex-1">
                          {thread.title || DEFAULT_UNTITLED_THREAD_TITLE}
                        </span>
                      </button>
                      {onDeleteThread ? (
                        <Popover
                          open={isDeleteConfirmationOpen}
                          onOpenChange={(open) =>
                            setPendingDeleteThreadId(open ? thread.id : null)
                          }
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              data-testid="archived-thread-delete-button"
                              disabled={isDeletingThread}
                              title="Delete archived thread"
                              className={cn(
                                "ml-auto flex size-5 shrink-0 items-center justify-center rounded text-white/35 opacity-0 transition-all duration-[var(--duration-fast)]",
                                "hover:bg-white/[0.08] hover:text-white/80",
                                "group-hover/archived:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                              )}
                              aria-label="Delete archived thread"
                            >
                              <Trash className="size-2.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            side="bottom"
                            className="w-auto min-w-[220px] rounded-md border border-white/[0.06] bg-[var(--color-bg-tertiary)] p-2 shadow-lg backdrop-blur-md"
                          >
                            <div className="space-y-2">
                              <p className="text-[13px] text-white/70">
                                Permanently delete this archived thread?
                              </p>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  data-testid="archived-thread-delete-cancel"
                                  disabled={isDeletingThread}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setPendingDeleteThreadId(null);
                                  }}
                                  className="rounded px-2 py-1 text-[13px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  data-testid="archived-thread-delete-confirm"
                                  disabled={isDeletingThread}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setPendingDeleteThreadId(null);
                                    void handleDeleteArchivedThread(thread.id);
                                  }}
                                  className="rounded bg-white/[0.08] px-2 py-1 text-[13px] text-white/85 transition-colors hover:bg-white/[0.14]"
                                >
                                  {isDeletingThread ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
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
            "fixed z-[100] min-w-[160px] rounded-md border border-white/[0.06] bg-[var(--color-bg-primary)] p-1 backdrop-blur-md",
            "shadow-[var(--shadow-hover)]",
            "animate-in fade-in-0 zoom-in-[0.98] duration-150 ease-out",
          )}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-2 py-1.5">
            <span className="block truncate text-[13px] text-[var(--color-text-secondary)]">
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Copy className="size-2.5" />
            <span>Copy path</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() => onOpenInFinder?.(contextMenuRepositoryId))
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Folder className="size-2.5" />
            <span>Open in Finder</span>
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-[var(--accent-pale-red-text)]",
              "transition-colors duration-100",
              "hover:bg-[var(--accent-pale-red-bg)]",
            )}
          >
            <Trash className="size-2.5" />
            <span>Remove</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
