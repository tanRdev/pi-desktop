import {
  moveRepositorySnapshots,
  type RepositoryDisplayMetadata,
  type RepositorySnapshot,
} from "@pidesk/shared";
import {
  ArrowLeft,
  Bug,
  FolderOpen,
  FolderPlus,
  Puzzle,
  Search,
  Settings,
  Share2,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";

export type RailView =
  | "explorer"
  | "search"
  | "source"
  | "debug"
  | "extensions"
  | null;
export const LEFT_RAIL_WIDTH = 64;

const NAVIGATION_ITEMS: Array<{
  view: Exclude<RailView, null>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { view: "explorer", label: "EXPLORER", icon: FolderOpen },
  { view: "search", label: "SEARCH", icon: Search },
  { view: "source", label: "SOURCE", icon: Share2 },
  { view: "debug", label: "DEBUG", icon: Bug },
  { view: "extensions", label: "EXT", icon: Puzzle },
];

export interface LeftRailProps {
  repositories: RepositorySnapshot[];
  mode: "projects" | "workspace";
  activeRepositoryId: string | null;
  activeView: RailView;
  onSelectRepository: (repositoryId: string) => void;
  onUpdateRepositoryPreferences: (
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ) => void | Promise<void>;
  onAddRepository: () => void;
  onOpenSettings: () => void;
  onShowProjects: () => void;
  onEnterWorkspace: (view: Exclude<RailView, null>) => void;
  onSelectView: (view: RailView) => void;
}

export function LeftRail({
  repositories,
  mode,
  activeRepositoryId,
  activeView,
  onSelectRepository,
  onUpdateRepositoryPreferences: _onUpdateRepositoryPreferences,
  onAddRepository,
  onOpenSettings,
  onShowProjects,
  onEnterWorkspace,
  onSelectView,
}: LeftRailProps) {
  const [orderedRepositories, setOrderedRepositories] =
    React.useState(repositories);
  const [draggedRepositoryId, setDraggedRepositoryId] = React.useState<
    string | null
  >(null);

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

  const handleSelectProject = React.useCallback(
    (repositoryId: string) => {
      onSelectRepository(repositoryId);
      onEnterWorkspace("explorer");
    },
    [onEnterWorkspace, onSelectRepository],
  );

  const handleShowProjects = React.useCallback(() => {
    onShowProjects();
  }, [onShowProjects]);

  const handleSelectNavigationView = React.useCallback(
    (view: Exclude<RailView, null>) => {
      if (activeView === view) {
        return;
      }

      onSelectView(view);
    },
    [activeView, onSelectView],
  );

  const activeRepository = orderedRepositories.find(
    (repository) => repository.id === activeRepositoryId,
  );
  const isProjectSelectionMode = mode === "projects";
  const activeRepositoryName =
    activeRepository?.customName ?? activeRepository?.name;

  return (
    <aside
      data-testid="left-rail"
      data-mode={mode}
      className={cn(
        "fixed left-0 top-10 z-40 h-[calc(100vh-64px)] bg-[#0e0e0e]",
      )}
      style={{ width: LEFT_RAIL_WIDTH }}
    >
      <div className="flex h-full flex-col border-r border-[#474747]/15">
        <div className="flex h-12 items-center justify-center border-b border-[#474747]/15 px-1.5">
          {isProjectSelectionMode ? (
            <span className="px-1.5 text-center font-mono text-[9px] uppercase leading-none tracking-[0.08em] text-[#6f6f6f]">
              Projects
            </span>
          ) : (
            <button
              type="button"
              onClick={handleShowProjects}
              className={cn(
                "flex h-8 w-full items-center justify-center gap-1.5 px-2 text-[#919191]",
                "transition-[transform,background-color,color] duration-200 ease-out",
                "hover:bg-[#1a1a1a] hover:text-white active:scale-[0.97]",
              )}
              aria-label="Return to project selection"
              title="Return to project selection"
            >
              <ArrowLeft className="size-3.5" />
              <span className="font-mono text-[8px] uppercase tracking-[0.08em]">
                Back
              </span>
            </button>
          )}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center gap-3 px-2 py-3",
              "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
              isProjectSelectionMode
                ? "translate-x-0 opacity-100"
                : "-translate-x-6 opacity-0 pointer-events-none",
            )}
          >
            <div className="flex w-full flex-col items-center gap-3 overflow-y-auto pb-3">
              {orderedRepositories.map((repository, index) => (
                <div
                  key={repository.id}
                  className="flex justify-center"
                  style={{
                    transitionDelay: isProjectSelectionMode
                      ? `${Math.min(index * 28, 180)}ms`
                      : "0ms",
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={() => handleDrop(repository.id)}
                >
                  <ProjectAvatar
                    repository={repository}
                    isActive={repository.id === activeRepositoryId}
                    onClick={() => handleSelectProject(repository.id)}
                    draggable
                    onDragStart={() => setDraggedRepositoryId(repository.id)}
                    onDragEnd={() => setDraggedRepositoryId(null)}
                    className={cn(
                      "size-8",
                      draggedRepositoryId === repository.id && "opacity-50",
                    )}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onAddRepository}
              className={cn(
                "flex h-9 w-9 items-center justify-center border border-[#474747]/25 bg-[#151515] text-[#919191]",
                "transition-[transform,background-color,color,border-color] duration-200 ease-out",
                "hover:border-[#8c8c8c]/40 hover:bg-white hover:text-black active:scale-[0.96]",
              )}
              aria-label="Add repository"
              title="Add repository"
            >
              <FolderPlus className="size-4" />
            </button>
          </div>

          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center gap-3 px-2 py-3",
              "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
              isProjectSelectionMode
                ? "translate-x-6 opacity-0 pointer-events-none"
                : "translate-x-0 opacity-100",
            )}
          >
            <div className="flex w-full flex-col items-center gap-3">
              {activeRepository ? (
                <div className="flex flex-col items-center gap-1.5">
                  <ProjectAvatar
                    repository={activeRepository}
                    isActive
                    className="size-8"
                  />
                  <span
                    className="max-w-full truncate px-1 text-center font-mono text-[8px] uppercase tracking-[0.08em] text-[#6f6f6f]"
                    title={activeRepositoryName}
                  >
                    {activeRepositoryName}
                  </span>
                </div>
              ) : null}

              <div className="flex w-full flex-col gap-2">
                {NAVIGATION_ITEMS.map(({ view, label, icon: Icon }) => {
                  const isActive = activeView === view;

                  return (
                    <button
                      key={view}
                      type="button"
                      onClick={() => handleSelectNavigationView(view)}
                      className={cn(
                        "flex w-full flex-col items-center gap-1 px-1.5 py-2 font-mono text-[8px] uppercase tracking-[0.08em]",
                        "transition-[transform,background-color,color] duration-200 ease-out",
                        "active:scale-[0.97]",
                        isActive
                          ? "bg-white text-black"
                          : "text-[#5d5d5d] hover:bg-[#1a1a1a] hover:text-white",
                      )}
                    >
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto h-9" />
          </div>
        </div>

        <div className="flex items-center justify-center border-t border-[#474747]/15 px-2 py-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className={cn(
              "flex h-8 w-8 items-center justify-center text-[#5d5d5d]",
              "transition-[transform,background-color,color] duration-200 ease-out",
              "hover:bg-[#1a1a1a] hover:text-white active:scale-[0.96]",
            )}
            aria-label="Open settings"
            title="Open settings"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
