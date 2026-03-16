import type { RepositorySnapshot } from "@pidesk/shared";
import { Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ProjectAvatar } from "./project-avatar";

export interface LeftRailProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  onSelectRepository: (repositoryId: string) => void;
  onAddRepository: () => void;
  onOpenSettings: () => void;
}

export function LeftRail({
  repositories,
  activeRepositoryId,
  onSelectRepository,
  onAddRepository,
  onOpenSettings,
}: LeftRailProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-16 shrink-0 flex-col border-r border-border bg-surface-1",
      )}
    >
      {/* Project avatars area */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pt-3">
        {repositories.map((repository) => (
          <ProjectAvatar
            key={repository.id}
            repository={repository}
            isActive={repository.id === activeRepositoryId}
            onClick={() => onSelectRepository(repository.id)}
          />
        ))}
      </div>

      {/* Bottom actions - Add and Settings */}
      <div className="flex flex-col items-center gap-2 border-t border-border px-2 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          onClick={onAddRepository}
          aria-label="Add repository"
        >
          <Plus className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </aside>
  );
}
