import type {
  RepositoryDisplayMetadata,
  RepositorySnapshot,
  ThreadSnapshot,
  WorktreeSnapshot,
} from "@pidesk/shared";
import { moveRepositorySnapshots } from "@pidesk/shared";
import { FolderPlus, Settings, Sparkles } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";
import { ProjectCustomizationMenu } from "./project-customization-menu";
import { WorktreeSection } from "./worktree-section";

export const LEFT_RAIL_WIDTH = 320;

function getRepositoryName(repository: RepositorySnapshot): string {
  return repository.customName?.trim() || repository.name;
}

function getRepositorySubtitle(repository: RepositorySnapshot): string {
  const visibleThreadCount = repository.worktrees.reduce(
    (count, worktree) =>
      count + worktree.threads.filter((thread) => !thread.isArchived).length,
    0,
  );

  return `${repository.worktrees.length} worktrees · ${visibleThreadCount} threads`;
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
  onSelectRepository: (repositoryId: string) => void;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: (worktreeId: string) => void | Promise<void>;
  onCloseThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
  onCreateWorktree: () => void;
  onUpdateRepositoryPreferences: (
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ) => void | Promise<void>;
  onAddRepository: () => void;
  onOpenSettings: () => void;
}

export function LeftRail({
  repositories,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  onSelectRepository,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCloseThread,
  onRenameThread,
  onCreateWorktree,
  onUpdateRepositoryPreferences,
  onAddRepository,
  onOpenSettings,
}: LeftRailProps) {
  const [orderedRepositories, setOrderedRepositories] =
    React.useState(repositories);
  const [draggedRepositoryId, setDraggedRepositoryId] = React.useState<
    string | null
  >(null);
  const [customizationRepositoryId, setCustomizationRepositoryId] =
    React.useState<string | null>(null);
  const [expandedWorktreesByRepositoryId, setExpandedWorktreesByRepositoryId] =
    React.useState<Record<string, string | null>>({});

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

  const handleAddRepository = React.useCallback(() => {
    setCustomizationRepositoryId(null);
    onAddRepository();
  }, [onAddRepository]);

  const handleOpenSettings = React.useCallback(() => {
    setCustomizationRepositoryId(null);
    onOpenSettings();
  }, [onOpenSettings]);

  const handleSelectRepositoryItem = React.useCallback(
    (repositoryId: string) => {
      setCustomizationRepositoryId(null);
      onSelectRepository(repositoryId);
    },
    [onSelectRepository],
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
      className="relative z-20 flex h-full shrink-0 flex-col border-r border-[#474747]/18 bg-[#090909]"
      style={{ width: LEFT_RAIL_WIDTH }}
    >
      <div className="border-b border-[#474747]/18 px-4 py-4">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleAddRepository}
            className={cn(
              "chrome-icon-button flex size-9 items-center justify-center border border-[#474747]/20 bg-[#121212] text-[#8a8a8a]",
              "hover:border-white/35 hover:bg-[#171717] hover:text-white",
            )}
            aria-label="Add repository"
            title="Add repository"
          >
            <FolderPlus className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
        <div className="h-full space-y-3 overflow-hidden">
          {orderedRepositories.map((repository) => {
            const repositoryName = getRepositoryName(repository);
            const isActive = repository.id === activeRepositoryId;
            const isCustomizationOpen =
              customizationRepositoryId === repository.id;
            const expandedWorktreeId = resolveExpandedWorktreeId(
              repository.worktrees,
              isActive ? activeWorktreeId : null,
              expandedWorktreesByRepositoryId[repository.id] ?? null,
            );

            return (
              <section
                key={repository.id}
                className={cn(
                  "relative overflow-hidden border",
                  isActive
                    ? "border-[#474747]/28 bg-[#101010]"
                    : "border-[#474747]/14 bg-[#0c0c0c]",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={() => handleDrop(repository.id)}
              >
                <button
                  type="button"
                  data-testid="project-rail-item"
                  data-active={isActive ? "true" : "false"}
                  draggable
                  onDragStart={() => setDraggedRepositoryId(repository.id)}
                  onDragEnd={() => setDraggedRepositoryId(null)}
                  onClick={() => handleSelectRepositoryItem(repository.id)}
                  className={cn(
                    "flex w-full items-center justify-start gap-3 px-4 py-3 text-left",
                    "transition-[background-color,border-color,color,transform] duration-150 ease-out",
                    "hover:bg-[#141414]",
                    draggedRepositoryId === repository.id && "opacity-50",
                  )}
                  aria-label={`Open repository ${repositoryName}`}
                >
                  <ProjectAvatar
                    repository={repository}
                    isActive={isActive}
                    className="size-9 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {repositoryName}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[#7a7a7a]">
                      {getRepositorySubtitle(repository)}
                    </span>
                  </span>
                </button>

                {isActive ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCustomizationRepositoryId((currentId) =>
                        currentId === repository.id ? null : repository.id,
                      )
                    }
                    className={cn(
                      "absolute right-3 top-3 flex h-7 items-center gap-1.5 border border-[#474747]/20 bg-[#121212] px-2",
                      "font-mono text-[9px] uppercase tracking-[0.08em] text-[#7a7a7a] transition-colors",
                      "hover:border-white/35 hover:text-white",
                    )}
                    aria-label={`Customize ${repositoryName}`}
                    aria-expanded={isCustomizationOpen}
                  >
                    <Sparkles className="size-3" />
                    Edit
                  </button>
                ) : null}

                <div className="border-t border-[#474747]/12 px-3 py-2">
                  <div className="space-y-1.5">
                    {repository.worktrees.length > 0 ? (
                      repository.worktrees.map((worktree, index) => (
                        <div
                          key={worktree.id}
                          className="stagger-item"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <WorktreeSection
                            worktree={worktree}
                            activeThreadId={isActive ? activeThreadId : null}
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
                      ))
                    ) : (
                      <div className="chrome-empty-state px-3 py-3 text-sm text-[#7a7a7a]">
                        No worktrees yet.
                      </div>
                    )}
                  </div>
                </div>

                <ProjectCustomizationMenu
                  repository={repository}
                  open={isCustomizationOpen}
                  updateRepositoryPreferences={onUpdateRepositoryPreferences}
                  side="right"
                  className="pointer-events-auto absolute left-full top-1 z-50 ml-3"
                />
              </section>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#474747]/18 px-3 py-3">
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onCreateWorktree}
            className={cn(
              "flex w-full items-center gap-3 border border-[#474747]/20 px-3 py-2.5 text-left",
              "text-[#7a7a7a] transition-colors hover:border-white/35 hover:bg-[#121212] hover:text-white",
            )}
            aria-label="Create worktree"
            title="Create worktree"
          >
            <FolderPlus className="size-4 shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
              New worktree
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenSettings}
            className={cn(
              "flex w-full items-center gap-3 border border-[#474747]/20 px-3 py-2.5 text-left",
              "text-[#7a7a7a] transition-colors hover:border-white/35 hover:bg-[#121212] hover:text-white",
            )}
            aria-label="Open settings"
            title="Open settings"
          >
            <Settings className="size-4 shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
              Settings
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
