import type { RepositorySnapshot, WorktreeSnapshot } from "@pidesk/shared";
import { moveRepositorySnapshots } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FolderPlus, Stack } from "@/components/ui/icons";
import { ProjectAvatar } from "./project-avatar";
import { RepositorySwitcher } from "./repository-switcher";
import { WorktreeSection } from "./worktree-section";

export const LEFT_RAIL_WIDTH = 260;

function getRepositoryName(repository: RepositorySnapshot): string {
  return repository.customName?.trim() || repository.name;
}

function getAllProjectsSummary(repositories: RepositorySnapshot[]): string {
  const threadCount = repositories.reduce(
    (count, repository) =>
      count +
      repository.worktrees.reduce(
        (threadTotal, worktree) =>
          threadTotal +
          worktree.threads.filter((thread) => !thread.isArchived).length,
        0,
      ),
    0,
  );

  return `${repositories.length} projects · ${threadCount} threads`;
}

function resolveExpandedWorktreeId(
  worktrees: WorktreeSnapshot[],
  activeWorktreeId: string | null,
  expandedRepositoryId: string | null,
): string | null {
  if (
    expandedRepositoryId &&
    worktrees.some((worktree) => worktree.id === expandedRepositoryId)
  ) {
    return expandedRepositoryId;
  }

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
  onAddRepository,
}: LeftRailProps) {
  const [orderedRepositories, setOrderedRepositories] =
    React.useState(repositories);
  const [draggedRepositoryId, setDraggedRepositoryId] = React.useState<
    string | null
  >(null);
  const [expandedWorktreesByRepositoryId, setExpandedWorktreesByRepositoryId] =
    React.useState<Record<string, string | null>>({});
  const [isResizing, setIsResizing] = React.useState(false);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(400, e.clientX));
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

  const activeRepository = orderedRepositories.find(
    (repository) => repository.id === activeRepositoryId,
  );

  return (
    <aside
      data-testid="left-rail"
      data-mode="workspace"
      className={cn(
        "relative z-20 flex h-full shrink-0 flex-col",
        // Glass morphism sidebar
        "glass-surface",
        "border-r border-[var(--glass-border-default)]",
      )}
      style={{ width }}
    >
      {/* Header - Glass effect with gradient */}
      <div className={cn(
        "flex items-center justify-between border-b px-3 py-3",
        "border-[var(--glass-border-subtle)]",
        "bg-gradient-to-b from-[var(--glass-bg-secondary)] to-transparent",
      )}>
        <div className="min-w-0 flex-1">
          <RepositorySwitcher
            repositories={orderedRepositories}
            activeRepositoryId={activeRepositoryId}
            onSelect={onSelectRepository}
            onAdd={onAddRepository}
            triggerLabel={
              activeRepository
                ? getRepositoryName(activeRepository)
                : "Projects"
            }
            triggerSubtitle={getAllProjectsSummary(orderedRepositories)}
            triggerAriaLabel="Switch projects"
          />
        </div>

        <button
          type="button"
          onClick={onAddRepository}
          className="ml-2 flex size-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] active:scale-95"
          aria-label="Add repository"
          title="Add repository"
        >
          <FolderPlus className="size-4" weight="regular" />
        </button>
      </div>

      {/* Empty state */}
      {orderedRepositories.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
            <Stack className="size-5 text-[var(--color-text-quaternary)]" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No projects yet
            </p>
            <p className="text-xs text-[var(--color-text-quaternary)]">
              Add a repository to get started
            </p>
          </div>
        </div>
      )}

      {/* Repository List - Compact, clean hierarchy */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="space-y-0.5 px-2">
          {orderedRepositories.map((repository) => {
            const repositoryName = getRepositoryName(repository);
            const isActive = repository.id === activeRepositoryId;
            const expandedWorktreeId = isActive
              ? resolveExpandedWorktreeId(
                  repository.worktrees,
                  activeWorktreeId,
                  expandedWorktreesByRepositoryId[repository.id] ?? null,
                )
              : null;

            return (
              <div
                key={repository.id}
                className={cn(
                  "rounded-lg transition-colors duration-[var(--duration-fast)]",
                  isActive && "bg-[var(--color-bg-tertiary)]",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={() => handleDrop(repository.id)}
              >
                {/* Repository Header - Clean, minimal with active accent */}
                <button
                  type="button"
                  data-testid="project-rail-item"
                  draggable
                  onDragStart={() => setDraggedRepositoryId(repository.id)}
                  onDragEnd={() => setDraggedRepositoryId(null)}
                  onClick={() => onSelectRepository(repository.id)}
                  className={cn(
                    "active-accent-left group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-all duration-[var(--duration-fast)]",
                    !isActive && "hover:bg-[var(--color-bg-hover)]",
                    draggedRepositoryId === repository.id && "opacity-50",
                    isActive && "active",
                  )}
                  data-active={isActive}
                  aria-label={`Open repository ${repositoryName}`}
                >
                  <ProjectAvatar
                    repository={repository}
                    isActive={isActive}
                    className="size-5 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[13px] font-medium leading-tight",
                        isActive
                          ? "text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      {repositoryName}
                    </span>
                  </span>
                </button>

                {/* Worktrees - Nested with subtle left border */}
                {isActive && repository.worktrees.length > 0 && (
                  <div className="pb-2 pl-7 pr-2">
                    <div className="space-y-0.5 border-l border-[var(--color-border-subtle)] pl-3">
                      {repository.worktrees.map((worktree, index) => (
                        <div
                          key={worktree.id}
                          className="stagger-item"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <WorktreeSection
                            worktree={worktree}
                            activeThreadId={activeThreadId}
                            isExpanded={expandedWorktreeId === worktree.id}
                            onToggleExpand={() =>
                              handleToggleWorktree(repository.id, worktree.id)
                            }
                            onSelectThread={(threadId: string) =>
                              handleSelectThreadFromRepository(
                                repository.id,
                                worktree.id,
                                threadId,
                              )
                            }
                            onCreateThread={() => onCreateThread(worktree.id)}
                            onCloseThread={onCloseThread}
                            onRenameThread={onRenameThread}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize",
          "transition-colors duration-[var(--duration-normal)]",
          "hover:bg-[var(--color-border-hover)]",
          isResizing && "bg-[var(--color-accent)]",
        )}
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize"
        role="presentation"
        aria-hidden="true"
      />
    </aside>
  );
}
