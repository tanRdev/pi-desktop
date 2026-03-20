import {
  moveRepositorySnapshots,
  type RepositoryDisplayMetadata,
  type RepositorySnapshot,
} from "@pidesk/shared";
import {
  Bug,
  FolderOpen,
  Network,
  Puzzle,
  Search,
  Settings,
  Share2,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";

export interface LeftRailProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  onSelectRepository: (repositoryId: string) => void;
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
  onSelectRepository,
  onUpdateRepositoryPreferences,
  onAddRepository,
  onOpenSettings,
}: LeftRailProps) {
  const [orderedRepositories, setOrderedRepositories] =
    React.useState(repositories);
  const [draggedRepositoryId, setDraggedRepositoryId] = React.useState<
    string | null
  >(null);
  const [openRepositoryId, setOpenRepositoryId] = React.useState<string | null>(
    null,
  );

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

  return (
    <aside
      className={cn(
        "fixed left-0 top-10 h-[calc(100vh-40px)] w-16 flex flex-col items-center py-4 gap-6 bg-[#0e0e0e] border-r border-[#474747]/30 z-40",
      )}
    >
      <div className="flex flex-col gap-6 items-center flex-1 w-full">
        <button
          type="button"
          className="flex flex-col items-center gap-1 group w-full"
        >
          <FolderOpen className="size-4 text-[#474747] group-hover:text-white transition-colors" />
          <span className="font-mono text-[8px] text-[#474747] uppercase group-hover:text-white">
            EXPLORER
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 group w-full"
        >
          <Search className="size-4 text-[#474747] group-hover:text-white transition-colors" />
          <span className="font-mono text-[8px] text-[#474747] uppercase group-hover:text-white">
            SEARCH
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 group bg-white text-black py-2 w-full"
        >
          <Share2 className="size-4" />
          <span className="font-mono text-[8px] uppercase">SOURCE</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 group w-full"
        >
          <Bug className="size-4 text-[#474747] group-hover:text-white transition-colors" />
          <span className="font-mono text-[8px] text-[#474747] uppercase group-hover:text-white">
            DEBUG
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 group w-full"
        >
          <Puzzle className="size-4 text-[#474747] group-hover:text-white transition-colors" />
          <span className="font-mono text-[8px] text-[#474747] uppercase group-hover:text-white">
            EXTENSIONS
          </span>
        </button>

        <div className="w-full border-t border-[#474747]/20 pt-4 flex flex-col gap-4 items-center">
          {orderedRepositories.map((repository) => (
            <div
              key={repository.id}
              className="group relative flex justify-center"
              onMouseEnter={() => setOpenRepositoryId(repository.id)}
              onMouseLeave={() =>
                setOpenRepositoryId((currentId) =>
                  currentId === repository.id ? null : currentId,
                )
              }
            >
              <ProjectAvatar
                repository={repository}
                isActive={repository.id === activeRepositoryId}
                onClick={() => onSelectRepository(repository.id)}
                className="size-8"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 items-center mb-4">
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-[#474747] hover:text-white transition-colors"
        >
          <Settings className="size-4" />
        </button>
        <button
          type="button"
          className="text-[#474747] hover:text-white transition-colors"
        >
          <Network className="size-4" />
        </button>
      </div>
    </aside>
  );
}
