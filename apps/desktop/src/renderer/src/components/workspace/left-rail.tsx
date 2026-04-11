import type { RepositorySnapshot, ThreadSnapshot } from "@pidesk/shared";
import { moveRepositorySnapshots } from "@pidesk/shared";
import * as React from "react";
import {
  Archive,
  Copy,
  Folder,
  PencilSimple,
  Pi,
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
import {
  deriveThreadDisplayStatus,
  ThreadStatusIcon,
} from "./thread-status-icon";

// Sidebar width for minimalist layout
export const SIDEBAR_WIDTH = 240;

function getRepositoryName(repository: RepositorySnapshot): string {
  return repository.customName?.trim() || repository.name;
}

export interface LeftRailProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  width: number;
  onResize: (width: number) => void;
  onSelectRepository: (repositoryId: string) => void;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: (worktreeId: string) => string | Promise<string>;
  onCloseThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
  onAddRepository: () => void;
  onToggleVisible?: () => void;
  onOpenSettings?: () => void;
  onOpenFilter?: () => void;
  onNewAgent?: () => void;
  onRenameRepository?: (repositoryId: string, name: string) => void;
  onRemoveRepository?: (repositoryId: string) => void;
  onCopyRepositoryPath?: (repositoryId: string) => void;
  onOpenInFinder?: (repositoryId: string) => void;
}

const FALLBACK_THREAD_NAMES = [
  "Thread Atlas",
  "Thread Ember",
  "Thread Nova",
  "Thread Quartz",
  "Thread Harbor",
] as const;

function generateFallbackThreadName(): string {
  return (
    FALLBACK_THREAD_NAMES[
      Math.floor(Math.random() * FALLBACK_THREAD_NAMES.length)
    ] ?? "New thread"
  );
}

/** Collect all threads across worktrees from the active repository. */
function collectThreads(
  repositories: RepositorySnapshot[],
  activeRepositoryId: string | null,
) {
  const repo = repositories.find((r) => r.id === activeRepositoryId);
  if (!repo)
    return { active: [] as ThreadSnapshot[], archived: [] as ThreadSnapshot[] };

  const active: ThreadSnapshot[] = [];
  const archived: ThreadSnapshot[] = [];

  for (const worktree of repo.worktrees) {
    for (const thread of worktree.threads) {
      if (thread.isArchived) {
        archived.push(thread);
      } else {
        active.push(thread);
      }
    }
  }

  return { active, archived };
}

function TallyBars({
  count,
  maxBars = 12,
  colorClassName = "bg-white/20",
}: {
  count: number;
  maxBars?: number;
  colorClassName?: string;
}) {
  const bars = Math.min(count, maxBars);
  return (
    <div className="flex gap-[2.5px] items-center ml-2 overflow-hidden shrink-0 pointer-events-none">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-[1.5px] rounded-full transition-opacity group-hover/item:opacity-100 opacity-60",
            colorClassName,
          )}
        />
      ))}
      {count > maxBars && (
        <span className="text-[8px] ml-0.5 font-medium opacity-60 group-hover/item:opacity-100 text-white/60">
          +
        </span>
      )}
    </div>
  );
}

interface ThreadCategorySectionProps {
  label: string;
  icon: React.ElementType;
  count: number;
  tallyColor?: string;
  children?: React.ReactNode;
  isWorking?: boolean;
  onAction?: () => void;
  actionLabel?: string;
}

function ThreadCategorySection({
  label,
  icon: Icon,
  count,
  tallyColor,
  children,
  isWorking,
  onAction,
  actionLabel,
}: ThreadCategorySectionProps) {
  return (
    <div className="relative space-y-0.5">
      <div
        className={cn(
          "flex w-full items-center justify-between rounded px-2 py-2 text-[12px] text-white/50",
          "group/item",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
          <span className="flex size-4 shrink-0 items-center justify-center">
            {isWorking ? (
              <ThreadStatusIcon displayStatus="working" />
            ) : (
              <Icon className="size-3.5 text-white/40" />
            )}
          </span>
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center ml-2">
          {onAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
              className="hidden group-hover/item:flex size-5 items-center justify-center rounded hover:bg-white/10 hover:text-white/80 transition-colors text-white/40"
              title={actionLabel}
            >
              <Plus className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="pl-4">
        <div className="py-1 space-y-0.5">{children}</div>
      </div>
    </div>
  );
}

export function LeftRail({
  repositories,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  width,
  onResize,
  onSelectRepository,
  onSelectThread,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onCreateThread,
  onCloseThread,
  onRenameThread,
  onAddRepository,
  onToggleVisible,
}: LeftRailProps) {
  const [orderedRepositories, setOrderedRepositories] =
    React.useState(repositories);
  const [draggedRepositoryId, setDraggedRepositoryId] = React.useState<
    string | null
  >(null);
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
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const [renameState, setRenameState] = React.useState<{
    repositoryId: string;
    value: string;
  } | null>(null);
  const [inlineEditingThreadId, setInlineEditingThreadId] = React.useState<
    string | null
  >(null);
  const [inlineEditingValue, setInlineEditingValue] = React.useState("");
  const [isCreatingThread, setIsCreatingThread] = React.useState(false);
  const inlineThreadInputRef = React.useRef<HTMLInputElement>(null);

  const { active: activeThreads, archived: archivedThreads } = React.useMemo(
    () => collectThreads(repositories, activeRepositoryId),
    [repositories, activeRepositoryId],
  );

  const isAnyActiveThreadWorking = React.useMemo(
    () =>
      activeThreads.some(
        (t) =>
          t.runtime.status === "streaming" || t.runtime.status === "starting",
      ),
    [activeThreads],
  );

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

  const persistRepositoryOrder = React.useCallback(
    async (nextRepositories: RepositorySnapshot[]) => {
      await window.pidesk.repositories.reorder(
        nextRepositories.map((repository) => repository.id),
      );
    },
    [],
  );

  React.useEffect(() => {
    setOrderedRepositories(repositories);
  }, [repositories]);

  React.useEffect(() => {
    if (!renameState) {
      return;
    }

    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renameState]);

  React.useEffect(() => {
    if (!inlineEditingThreadId) {
      return;
    }

    inlineThreadInputRef.current?.focus();
    inlineThreadInputRef.current?.select();
  }, [inlineEditingThreadId]);

  const startInlineEdit = React.useCallback(
    (threadId: string, initialValue: string) => {
      setInlineEditingThreadId(threadId);
      setInlineEditingValue(initialValue);
    },
    [],
  );

  const finishInlineEdit = React.useCallback(
    async (threadId: string, currentTitle: string) => {
      const nextTitle =
        inlineEditingValue.trim() || generateFallbackThreadName();
      setInlineEditingThreadId(null);
      setInlineEditingValue("");

      if (nextTitle === currentTitle.trim()) {
        return;
      }

      await onRenameThread?.(threadId, nextTitle);
    },
    [inlineEditingValue, onRenameThread],
  );

  const handleCreateThread = React.useCallback(async () => {
    if (!activeWorktreeId || isCreatingThread) {
      return;
    }

    setIsCreatingThread(true);
    try {
      const threadId = await onCreateThread(activeWorktreeId);
      startInlineEdit(threadId, "");
    } finally {
      setIsCreatingThread(false);
    }
  }, [activeWorktreeId, isCreatingThread, onCreateThread, startInlineEdit]);

  const _handleDrop = React.useCallback(
    (targetRepositoryId: string) => {
      if (!draggedRepositoryId) {
        return;
      }

      setOrderedRepositories((currentRepositories) => {
        const nextRepositories = moveRepositorySnapshots(
          currentRepositories,
          draggedRepositoryId,
          targetRepositoryId,
        );

        if (nextRepositories !== currentRepositories) {
          void persistRepositoryOrder(nextRepositories);
        }

        return nextRepositories;
      });
      setDraggedRepositoryId(null);
    },
    [draggedRepositoryId, persistRepositoryOrder],
  );

  const _handleContextMenu = React.useCallback(
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

  const activeRepository = repositories.find(
    (repo) => repo.id === activeRepositoryId,
  );
  const contextMenuRepositoryId = contextMenu.repositoryId;
  const activeRepositoryName = activeRepository
    ? getRepositoryName(activeRepository)
    : "Empty workspace";

  return (
    <aside
      data-testid="left-rail"
      data-mode="workspace"
      className={cn(
        "relative z-20 flex h-full shrink-0 select-none flex-col",
        // Minimalist: Clean dark surface with subtle border
        "bg-[#0a0a0a]",
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
          className="flex size-7 items-center justify-center rounded-md text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60"
        >
          <SidebarSimple className="size-4" />
        </button>
      </div>

      {/* Repository List */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="px-3 py-2 flex items-center justify-between group">
          <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider truncate mr-2">
            {activeRepositoryName}
          </div>
          <div className="flex gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onAddRepository}
                  aria-label="New workspace"
                  className="text-white/40 hover:text-white/80 p-0.5"
                >
                  <Folder className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">New workspace</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="space-y-0.5 px-2">
          {/* Sessions */}
          <ThreadCategorySection
            label="Sessions"
            icon={Pi}
            count={activeThreads.length}
            tallyColor="bg-[#22c55e]"
            isWorking={isAnyActiveThreadWorking}
            onAction={() => {
              void handleCreateThread();
            }}
            actionLabel="Create thread"
          >
            {activeThreads.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-white/20">
                No sessions
              </div>
            ) : (
              activeThreads.map((thread) => {
                const displayStatus = deriveThreadDisplayStatus(
                  thread.runtime.status,
                  thread.isArchived,
                );
                const isActive = thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      if (inlineEditingThreadId === thread.id) {
                        return;
                      }
                      onSelectThread(thread.id);
                    }}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] transition-colors",
                      isActive
                        ? "bg-white/[0.04] text-white/80"
                        : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <ThreadStatusIcon displayStatus={displayStatus} />
                    </span>
                    {inlineEditingThreadId === thread.id ? (
                      <input
                        ref={inlineThreadInputRef}
                        data-testid="thread-inline-input"
                        type="text"
                        value={inlineEditingValue}
                        onChange={(event) =>
                          setInlineEditingValue(event.target.value)
                        }
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => {
                          void finishInlineEdit(thread.id, thread.title || "");
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void finishInlineEdit(
                              thread.id,
                              thread.title || "",
                            );
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setInlineEditingThreadId(null);
                            setInlineEditingValue("");
                          }
                        }}
                        className="block min-w-0 flex-1 rounded border border-white/[0.12] bg-[#141414] px-2 py-1 text-[11px] text-white/85 outline-none focus:border-white/[0.2]"
                        placeholder="Name thread"
                      />
                    ) : (
                      <span className="truncate flex-1">
                        {thread.title || "Untitled thread"}
                      </span>
                    )}
                    <button
                      type="button"
                      data-testid="thread-archive-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onCloseThread?.(thread.id);
                      }}
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded opacity-0 transition-all duration-[var(--duration-fast)]",
                        "hover:bg-white/[0.08] hover:text-white/80",
                        "group-hover:opacity-100 focus-visible:opacity-100",
                      )}
                      aria-label="Archive thread"
                      title="Archive thread"
                    >
                      <Archive className="size-3" />
                    </button>
                  </button>
                );
              })
            )}
          </ThreadCategorySection>

          <div className="mt-4">
            {/* Archived threads */}
            <ThreadCategorySection
              label="Archived"
              icon={Archive}
              count={archivedThreads.length}
              tallyColor="bg-white/40"
            >
              {archivedThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] transition-colors",
                    "text-white/30 hover:bg-white/[0.04] hover:text-white/50",
                  )}
                >
                  <Archive className="size-3 shrink-0 text-white/20" />
                  <span className="truncate flex-1">
                    {thread.title || "Untitled thread"}
                  </span>
                </button>
              ))}
            </ThreadCategorySection>
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize",
          "transition-colors duration-[var(--duration-normal)]",
          "bg-transparent hover:bg-[var(--color-border-strong)]",
          isResizing && "bg-[var(--color-text-muted)]",
        )}
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize"
        role="presentation"
        aria-hidden="true"
      />

      {/* Context Menu */}
      {contextMenu.isOpen && contextMenuRepositoryId !== null ? (
        <div
          ref={contextMenuRef}
          className={cn(
            "fixed z-[100] min-w-[160px] rounded-md border border-white/[0.06] bg-[#141414] p-1",
            "shadow-[var(--shadow-hover)]",
            "animate-in fade-in-0 zoom-in-[0.98] duration-150 ease-out",
          )}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-2 py-1.5">
            <span className="block truncate text-[10px] text-[var(--color-text-secondary)]">
              {contextMenu.repositoryName}
            </span>
          </div>
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() => {
                const repository = repositories.find(
                  (entry) => entry.id === contextMenu.repositoryId,
                );
                if (!repository) {
                  return;
                }

                setRenameState({
                  repositoryId: repository.id,
                  value: repository.customName ?? repository.name,
                });
              })
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <PencilSimple className="size-3" />
            <span>Rename</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onCopyRepositoryPath?.(contextMenuRepositoryId),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Copy className="size-3" />
            <span>Copy path</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() => onOpenInFinder?.(contextMenuRepositoryId))
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Folder className="size-3" />
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--accent-pale-red-text)]",
              "transition-colors duration-100",
              "hover:bg-[var(--accent-pale-red-bg)]",
            )}
          >
            <Trash className="size-3" />
            <span>Remove</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
