import {
  moveRepositorySnapshots,
  type RepositoryDisplayMetadata,
  type RepositorySnapshot,
} from "@pidesk/shared";
import { Plus, Settings } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ProjectAvatar } from "./project-avatar";
import { ProjectCustomizationMenu } from "./project-customization-menu";

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
        "flex h-full w-16 shrink-0 flex-col border-r border-border bg-surface-1",
      )}
    >
      <div className="flex flex-1 flex-col gap-2 overflow-x-visible overflow-y-auto px-2 pb-3 pt-3">
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
            onFocusCapture={() => setOpenRepositoryId(repository.id)}
            onBlurCapture={(event) => {
              if (
                event.currentTarget.contains(event.relatedTarget as Node | null)
              ) {
                return;
              }

              setOpenRepositoryId((currentId) =>
                currentId === repository.id ? null : currentId,
              );
            }}
            onDragOver={(event) => {
              if (
                !draggedRepositoryId ||
                draggedRepositoryId === repository.id
              ) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(repository.id);
            }}
          >
            <ProjectAvatar
              repository={repository}
              isActive={repository.id === activeRepositoryId}
              onClick={() => onSelectRepository(repository.id)}
              draggable={orderedRepositories.length > 1}
              onDragStart={(event) => {
                setDraggedRepositoryId(repository.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", repository.id);
              }}
              onDragEnd={() => setDraggedRepositoryId(null)}
              ariaControls={`project-customization-${repository.id}`}
              ariaExpanded={openRepositoryId === repository.id}
            />
            <ProjectCustomizationMenu
              repository={repository}
              open={openRepositoryId === repository.id}
              updateRepositoryPreferences={onUpdateRepositoryPreferences}
              side="right"
              className="absolute left-full top-1/2 z-20 -translate-y-1/2 pl-2"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5 border-t border-border px-2 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="chrome-icon-button h-9 w-9 rounded-lg text-muted-foreground"
          onClick={onAddRepository}
          aria-label="Add repository"
        >
          <Plus className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="chrome-icon-button h-9 w-9 rounded-lg text-muted-foreground"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </aside>
  );
}
