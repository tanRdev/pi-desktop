import type { RepositorySnapshot } from "@pidesk/shared";
import { moveRepositorySnapshots } from "@pidesk/shared";
import * as React from "react";
import {
  ChatText,
  Copy,
  Folder,
  Gear,
  type IconProps,
  PencilSimple,
  Pi,
  Plus,
  SquaresFour,
  Stack,
  Trash,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";

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
  onCreateThread: (worktreeId: string) => void | Promise<void>;
  onCloseThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
  onAddRepository: () => void;
  onOpenSettings?: () => void;
  onOpenFilter?: () => void;
  onNewAgent?: () => void;
  onOpenMarketplace?: () => void;
  onRenameRepository?: (repositoryId: string, name: string) => void;
  onRemoveRepository?: (repositoryId: string) => void;
  onCopyRepositoryPath?: (repositoryId: string) => void;
  onOpenInFinder?: (repositoryId: string) => void;
}

export function LeftRail({
  repositories,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  width,
  onResize,
  onSelectRepository,
  onRenameRepository,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCloseThread,
  onRenameThread,
  onAddRepository,
  onOpenMarketplace,
  onOpenSettings,
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

  const handleDrop = React.useCallback(
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

  const commitRename = React.useCallback(() => {
    if (!renameState) {
      return;
    }

    void onRenameRepository?.(renameState.repositoryId, renameState.value);
    setRenameState(null);
  }, [onRenameRepository, renameState]);

  return (
    <aside
      data-testid="left-rail"
      data-mode="workspace"
      className={cn(
        "relative z-20 flex h-full shrink-0 select-none flex-col",
        // Minimalist: Clean white surface with 1px border
        "bg-[var(--color-surface)]",
        "border-r border-[var(--color-border)]",
      )}
      style={{ width }}
    >
      {/* Drag region for macOS traffic lights */}
      <div data-drag-region="true" className="h-11 w-full shrink-0" />

      {/* Navigation Items */}
      <div className="px-3 pb-3">
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenMarketplace}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2",
            "text-[var(--color-text-secondary)] text-[13px]",
            "transition-all duration-[var(--duration-fast)]",
            "hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
          )}
        >
          <SquaresFour className="size-4" />
          <span>Packages</span>
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onAddRepository}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2",
            "text-[var(--color-text-secondary)] text-[13px]",
            "transition-all duration-[var(--duration-fast)]",
            "hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
          )}
        >
          <Plus className="size-4" />
          <span>Add workspace</span>
        </button>
      </div>

      {/* Section divider */}
      <div className="mx-3 h-px bg-[var(--color-border)]" />

      {/* Empty state */}
      {orderedRepositories.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <Stack className="size-4 text-[var(--color-text-muted)]" />
          <div className="space-y-0.5">
            <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
              No projects
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Open a workspace to begin
            </p>
          </div>
        </div>
      )}

      {/* Repository List */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="space-y-0.5 px-2">
          {orderedRepositories.map((repository) => {
            const repositoryName = getRepositoryName(repository);
            const isActive = repository.id === activeRepositoryId;

            // Combine all threads from all worktrees (excluding archived)
            const allThreads = repository.worktrees.flatMap(
              (wt) => wt.threads?.filter((t) => !t.isArchived) ?? [],
            );

            const hasActiveThreadInRepo = allThreads.some(
              (t) => t.id === activeThreadId,
            );

            // Get first worktree for creating new threads
            const firstWorktree = repository.worktrees[0];

            return (
              <div
                key={repository.id}
                className="transition-all duration-[var(--duration-fast)]"
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={() => handleDrop(repository.id)}
              >
                {/* Project root */}
                <button
                  type="button"
                  data-testid="project-rail-item"
                  draggable
                  onDragStart={() => setDraggedRepositoryId(repository.id)}
                  onDragEnd={() => setDraggedRepositoryId(null)}
                  onClick={() => onSelectRepository(repository.id)}
                  onContextMenu={(e) => handleContextMenu(e, repository)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-all duration-[var(--duration-fast)]",
                    "hover:bg-[var(--color-surface-secondary)] outline-none",
                    draggedRepositoryId === repository.id && "opacity-50",
                  )}
                  aria-label={`Open repository ${repositoryName}`}
                >
                  <ProjectAvatar
                    repository={repository}
                    isActive={isActive}
                    className="size-3.5 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    {renameState?.repositoryId === repository.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameState.value}
                        onChange={(event) =>
                          setRenameState((current) =>
                            current
                              ? { ...current, value: event.target.value }
                              : current,
                          )
                        }
                        onBlur={commitRename}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRename();
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            setRenameState(null);
                          }
                        }}
                        className="w-full select-text bg-transparent text-[12px] font-medium leading-tight tracking-[-0.01em] text-[var(--color-text-primary)] outline-none"
                        aria-label="Rename project"
                        data-testid="project-rename-input"
                      />
                    ) : (
                      <span
                        className={cn(
                          "block truncate text-[13px] leading-tight",
                          isActive || hasActiveThreadInRepo
                            ? "text-[var(--color-text-primary)] font-medium"
                            : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]",
                        )}
                      >
                        {repositoryName}
                      </span>
                    )}
                  </span>
                  {firstWorktree && (
                    <button
                      type="button"
                      aria-label="New session"
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded p-0.5 opacity-0 transition-all duration-[var(--duration-fast)]",
                        "group-hover:opacity-100",
                        "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateThread(firstWorktree.id);
                      }}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </button>

                {/* Threads directly under repository */}
                {isActive && allThreads.length > 0 && (
                  <div className="pb-2">
                    <div className="relative pl-3">
                      {/* Vertical line connecting project to threads */}
                      <div className="absolute left-[15px] top-0 bottom-2 w-px bg-[var(--color-border)]" />
                      <div className="space-y-0">
                        {allThreads.map((thread, index) => (
                          <div
                            key={thread.id}
                            className="stagger-item relative"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            {/* Horizontal connector line */}
                            <div className="absolute left-0 top-[14px] w-3 h-px bg-[var(--color-border)]" />
                            <div className="pl-4">
                              <button
                                data-testid="thread-list-item"
                                type="button"
                                onClick={() => {
                                  onSelectThread(thread.id);
                                }}
                                className={cn(
                                  "group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-all duration-[var(--duration-fast)]",
                                  thread.id === activeThreadId
                                    ? "bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]"
                                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-secondary)]",
                                )}
                              >
                                <ChatText
                                  className={cn(
                                    "size-3 shrink-0 transition-colors duration-150",
                                    thread.id === activeThreadId
                                      ? "text-[var(--color-text-secondary)]"
                                      : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]",
                                  )}
                                />
                                <span
                                  className={cn(
                                    "block min-w-0 flex-1 truncate text-[11px] leading-tight transition-colors duration-150",
                                    thread.id === activeThreadId
                                      ? "font-medium text-[var(--color-text-primary)]"
                                      : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]",
                                  )}
                                >
                                  {thread.title || "Untitled thread"}
                                </span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* New thread button */}
                      {firstWorktree && (
                        <button
                          type="button"
                          data-testid="create-thread-button"
                          aria-label="Create thread"
                          className={cn(
                            "relative mt-1 flex h-7 w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px]",
                            "text-[var(--color-text-muted)] transition-all duration-[var(--duration-fast)]",
                            "hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-secondary)]",
                          )}
                          onClick={() => onCreateThread(firstWorktree.id)}
                        >
                          {/* Horizontal connector */}
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-[var(--color-border)]" />
                          <div className="pl-4 flex items-center gap-1.5">
                            <Plus className="size-3" />
                            <span className="text-[11px]">New thread</span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider above Pi branding */}
      <div className="mx-3 h-px bg-[var(--color-border)]" />

      {/* Pi branding - bottom */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between rounded-md px-2.5 py-2">
          <div className="flex items-center gap-2.5">
            <Pi className="size-4 text-[var(--color-text-secondary)]" />
            <span className="text-[13px] text-[var(--color-text-muted)]">
              Pi Desktop v0.1.0
            </span>
          </div>
          <button
            type="button"
            data-no-drag="true"
            onClick={onOpenSettings}
            className={cn(
              "flex items-center justify-center rounded p-1.5",
              "text-[var(--color-text-secondary)]",
              "transition-all duration-[var(--duration-fast)]",
              "hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
            )}
          >
            <Gear className="size-4" />
          </button>
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
      {contextMenu.isOpen && contextMenu.repositoryId && (
        <div
          ref={contextMenuRef}
          className={cn(
            "fixed z-[100] min-w-[160px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1",
            "shadow-[var(--shadow-hover)]",
            "animate-in fade-in-0 zoom-in-[0.98] duration-150 ease-out",
          )}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-2 py-1.5">
            <span className="block truncate text-[11px] font-medium text-[var(--color-text-secondary)]">
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <PencilSimple className="size-3.5" />
            <span>Rename</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onCopyRepositoryPath?.(contextMenu.repositoryId!),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Copy className="size-3.5" />
            <span>Copy path</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onOpenInFinder?.(contextMenu.repositoryId!),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Folder className="size-3.5" />
            <span>Open in Finder</span>
          </button>
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onRemoveRepository?.(contextMenu.repositoryId!),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--accent-pale-red-text)]",
              "transition-colors duration-100",
              "hover:bg-[var(--accent-pale-red-bg)]",
            )}
          >
            <Trash className="size-3.5" />
            <span>Remove</span>
          </button>
        </div>
      )}
    </aside>
  );
}
