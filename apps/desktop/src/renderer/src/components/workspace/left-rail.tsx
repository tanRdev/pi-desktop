import type { RepositorySnapshot, WorktreeSnapshot } from "@pidesk/shared";
import { moveRepositorySnapshots } from "@pidesk/shared";
import * as React from "react";
import {
  Copy,
  Folder,
  FolderOpen,
  Gear,
  Minus,
  PencilSimple,
  Pi,
  Plus,
  SquaresFour,
  Stack,
  Trash,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";
import { WorktreeSection } from "./worktree-section";

// Item 3: reduced from 280
export const SIDEBAR_WIDTH = 220;

function getRepositoryName(repository: RepositorySnapshot): string {
  return repository.customName?.trim() || repository.name;
}

function resolveExpandedWorktreeId(
  worktrees: WorktreeSnapshot[],
  activeWorktreeId: string | null,
  expandedRepositoryId: string | null | undefined,
): string | null {
  // If explicitly set (including null meaning collapsed), respect it
  if (expandedRepositoryId !== undefined) {
    return expandedRepositoryId; // null = collapsed, string = expanded worktree
  }

  // Default: use active worktree
  if (
    activeWorktreeId &&
    worktrees.some((worktree) => worktree.id === activeWorktreeId)
  ) {
    return activeWorktreeId;
  }

  return worktrees[0]?.id ?? null;
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
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCloseThread,
  onRenameThread,
  onOpenSettings,
  onOpenFilter,
  onNewAgent,
  onOpenMarketplace,
  onAddRepository,
  onRenameRepository,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
}: LeftRailProps) {
  const [orderedRepositories, setOrderedRepositories] =
    React.useState(repositories);
  const [draggedRepositoryId, setDraggedRepositoryId] = React.useState<
    string | null
  >(null);
  const [expandedWorktreesByRepositoryId, setExpandedWorktreesByRepositoryId] =
    React.useState<Record<string, string | null>>({});
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
      // Item 3: updated min/max constraints
      const newWidth = Math.max(160, Math.min(320, e.clientX));
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

  const handleToggleWorktree = React.useCallback(
    (repositoryId: string, worktreeId: string) => {
      setExpandedWorktreesByRepositoryId((currentState) => {
        const nextExpandedId =
          currentState[repositoryId] === worktreeId ? null : worktreeId;

        return {
          ...currentState,
          [repositoryId]: nextExpandedId,
        };
      });

      if (activeWorktreeId !== worktreeId) {
        onSelectWorktree(worktreeId);
      }
    },
    [activeWorktreeId, onSelectWorktree],
  );

  const handleSelectThreadFromRepository = React.useCallback(
    (repositoryId: string, worktreeId: string, threadId: string) => {
      setExpandedWorktreesByRepositoryId((currentState) => ({
        ...currentState,
        [repositoryId]: worktreeId,
      }));

      if (activeWorktreeId !== worktreeId) {
        onSelectWorktree(worktreeId);
      }

      onSelectThread(threadId);
    },
    [activeWorktreeId, onSelectThread, onSelectWorktree],
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
        // Item 4: use CSS variable for sidebar background
        "bg-[var(--color-bg-secondary)]",
        "border-r border-white/[0.04]",
      )}
      style={{ width }}
    >
      {/* Item 2: Drag region for macOS traffic lights (44px clearance) */}
      <div data-drag-region="true" className="h-11 w-full shrink-0" />

      {/* Navigation Items */}
      <div className="px-3 pb-2">
        {/* Item 7: SquaresFour replaces Storefront (also fixes the Storefront bug) */}
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenMarketplace}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2",
            "text-white/40 text-[13px]",
            "transition-all duration-150",
            "hover:bg-white/[0.05] hover:text-white/70",
          )}
        >
          <SquaresFour className="size-4" weight="regular" />
          <span>Packages</span>
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onAddRepository}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2",
            "text-white/40 text-[13px]",
            "transition-all duration-150",
            "hover:bg-white/[0.05] hover:text-white/70",
          )}
        >
          <Plus className="size-4" weight="regular" />
          <span>Add new workspace</span>
        </button>
      </div>

      {/* Item 21: Softer section divider (opacity 0.02 was 0.03) */}
      <div className="mx-3 h-px bg-white/[0.03]" />

      {/* Item 8: "Projects" section header REMOVED — list starts immediately */}

      {/* Empty state */}
      {orderedRepositories.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <Stack className="size-4 text-white/20" />
          <div className="space-y-0.5">
            <p className="text-[12px] font-medium text-white/40">No projects</p>
            <p className="text-[11px] text-white/20">
              Open a workspace to begin
            </p>
          </div>
        </div>
      )}

      {/* Repository List */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        <div className="space-y-1 px-2">
          {orderedRepositories.map((repository) => {
            const repositoryName = getRepositoryName(repository);
            const isActive = repository.id === activeRepositoryId;
            const expandedWorktreeId = isActive
              ? resolveExpandedWorktreeId(
                  repository.worktrees,
                  activeWorktreeId,
                  expandedWorktreesByRepositoryId[repository.id],
                )
              : null;

            // Item 9: derive agent count for subtitle
            const totalThreads = repository.worktrees.reduce(
              (sum, wt) => sum + (wt.threads?.length ?? 0),
              0,
            );

            const hasActiveThreadInRepo = repository.worktrees.some((wt) =>
              wt.threads?.some((t) => t.id === activeThreadId),
            );

            return (
              <div
                key={repository.id}
                className="transition-all duration-[var(--duration-fast)]"
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={() => handleDrop(repository.id)}
              >
                {/* Project root - Linear style: refined, minimal, generous spacing */}
                <button
                  type="button"
                  data-testid="project-rail-item"
                  draggable
                  onDragStart={() => setDraggedRepositoryId(repository.id)}
                  onDragEnd={() => setDraggedRepositoryId(null)}
                  onClick={() => onSelectRepository(repository.id)}
                  onContextMenu={(e) => handleContextMenu(e, repository)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-all duration-150",
                    "hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none",
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
                        className="w-full select-text bg-transparent text-[12px] font-medium leading-tight tracking-[-0.01em] text-white/90 outline-none"
                        aria-label="Rename project"
                        data-testid="project-rename-input"
                      />
                    ) : (
                      <span
                        className={cn(
                          "block truncate text-[12px] leading-tight tracking-[-0.01em]",
                          isActive || hasActiveThreadInRepo
                            ? "text-white/90 font-medium"
                            : "text-white/35 group-hover:text-white/60",
                        )}
                      >
                        {repositoryName}
                      </span>
                    )}
                  </span>
                </button>

                {/* Worktrees — seamlessly connected with tree-like indentation */}
                {isActive && repository.worktrees.length > 0 && (
                  <div className="pb-2">
                    <div className="relative pl-3">
                      {/* Continuous vertical line connecting project to worktrees */}
                      <div className="absolute left-[15px] top-0 bottom-2 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.05] to-transparent" />
                      <div className="space-y-0">
                        {repository.worktrees.map((worktree, index) => (
                          <div
                            key={worktree.id}
                            className="stagger-item relative"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            {/* Horizontal connector line */}
                            <div className="absolute left-0 top-[14px] w-3 h-px bg-white/[0.05]" />
                            <div className="pl-4">
                              <WorktreeSection
                                worktree={worktree}
                                activeThreadId={activeThreadId}
                                isExpanded={expandedWorktreeId === worktree.id}
                                onToggleExpand={() =>
                                  handleToggleWorktree(
                                    repository.id,
                                    worktree.id,
                                  )
                                }
                                onSelectThread={(threadId: string) =>
                                  handleSelectThreadFromRepository(
                                    repository.id,
                                    worktree.id,
                                    threadId,
                                  )
                                }
                                onCreateThread={() =>
                                  onCreateThread(worktree.id)
                                }
                                onCloseThread={onCloseThread}
                                onRenameThread={onRenameThread}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider above Pi branding */}
      <div className="mx-3 h-px bg-white/[0.03]" />

      {/* Pi branding - bottom */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-2.5">
            {/* Pi Logo */}
            <Pi className="size-4 text-white/50" />
            <span className="text-[13px] text-white/40">Pi Desktop v0.1.0</span>
          </div>
          <button
            type="button"
            data-no-drag="true"
            onClick={onOpenSettings}
            className={cn(
              "flex items-center justify-center rounded p-1",
              "text-white/40",
              "transition-all duration-150",
              "hover:bg-white/[0.05] hover:text-white/70",
            )}
          >
            <Gear className="size-4" weight="regular" />
          </button>
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-[1px] cursor-col-resize",
          "transition-colors duration-[var(--duration-normal)]",
          "bg-transparent hover:bg-[var(--color-accent)]/30",
          isResizing && "bg-white/[0.12]",
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
            "fixed z-[100] min-w-[160px] rounded-md border border-white/[0.06] bg-[#141414] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            "animate-in fade-in-0 zoom-in-[0.98] duration-150 ease-out",
          )}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-2 py-1.5">
            <span className="block truncate text-[11px] font-medium text-white/50">
              {contextMenu.repositoryName}
            </span>
          </div>
          <div className="my-1 h-px bg-white/[0.06]" />
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-white/70",
              "transition-colors duration-100",
              "hover:bg-white/[0.08] hover:text-white/90",
            )}
          >
            <PencilSimple className="size-3.5" weight="regular" />
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-white/70",
              "transition-colors duration-100",
              "hover:bg-white/[0.08] hover:text-white/90",
            )}
          >
            <Copy className="size-3.5" weight="regular" />
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-white/70",
              "transition-colors duration-100",
              "hover:bg-white/[0.08] hover:text-white/90",
            )}
          >
            <Folder className="size-3.5" weight="regular" />
            <span>Open in Finder</span>
          </button>
          <div className="my-1 h-px bg-white/[0.06]" />
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onRemoveRepository?.(contextMenu.repositoryId!),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-red-400/80",
              "transition-colors duration-100",
              "hover:bg-red-500/10 hover:text-red-400",
            )}
          >
            <Trash className="size-3.5" weight="regular" />
            <span>Remove</span>
          </button>
        </div>
      )}
    </aside>
  );
}
