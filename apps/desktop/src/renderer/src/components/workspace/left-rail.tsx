import type {
  RepositoryDisplayMetadata,
  RepositorySnapshot,
} from "@pidesk/shared";
import { Plus, Settings } from "lucide-react";
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
  return (
    <aside
      className={cn(
        "flex h-full w-16 shrink-0 flex-col border-r border-border bg-surface-1",
      )}
    >
      <div className="flex flex-1 flex-col gap-2 overflow-x-visible overflow-y-auto px-2 pb-3 pt-3">
        {repositories.map((repository) => (
          <div
            key={repository.id}
            className="group relative flex justify-center"
          >
            <ProjectAvatar
              repository={repository}
              isActive={repository.id === activeRepositoryId}
              onClick={() => onSelectRepository(repository.id)}
            />
            <ProjectCustomizationMenu
              repository={repository}
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
