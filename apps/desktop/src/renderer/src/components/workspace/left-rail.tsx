import { FolderPlus } from "@phosphor-icons/react";
import type { RepositorySnapshot, WorktreeSnapshot } from "@pidesk/shared";
import { moveRepositorySnapshots } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
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
      className="relative z-20 flex h-full shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
      style={{ width }}
    >
      {/* Header - Clean and minimal */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-[var(--space-3)] py-[var(--space-3)]">
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
          className="ml-[var(--space-2)] flex size-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Add repository"
          title="Add repository"
        >
          <FolderPlus className="size-4" />
        </button>
      </div>

      {/* Repository List - Improved spacing and hierarchy */}
      <div className="min-h-0 flex-1 overflow-y-auto py-[var(--space-2)]">
        <div className="space-y-[var(--space-1)] px-[var(--space-2)]">
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
                {/* Repository Header - Active accent */}
                <button
                  type="button"
                  data-testid="project-rail-item"
                  draggable
                  onDragStart={() => setDraggedRepositoryId(repository.id)}
                  onDragEnd={() => setDraggedRepositoryId(null)}
                  onClick={() => onSelectRepository(repository.id)}
                  className={cn(
                    "active-accent-left flex w-full items-center gap-[var(--space-2)] rounded-lg px-[var(--space-2)] py-[var(--space-2)] text-left",
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
                    className="size-6 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-medium",
                        isActive
                          ? "text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      {repositoryName}
                    </span>
                  </span>
                </button>

                {/* Worktrees - Better nested spacing */}
                {isActive && repository.worktrees.length > 0 && (
                  <div className="pb-[var(--space-2)] pl-[var(--space-8)] pr-[var(--space-2)]">
                    <div className="space-y-[var(--space-1)] border-l border-[var(--color-border-subtle)] pl-[var(--space-2)]">
                      {repository.worktrees.map((worktree, index) => (
                        <div
                          key={worktree.id}
                          className="stagger-item"
                          style={{ animationDelay: `${index * 40}ms` }}
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

      {/* Resize handle - Improved visibility */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize",
          "hover:bg-[var(--color-accent)] transition-colors duration-[var(--duration-normal)]",
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
