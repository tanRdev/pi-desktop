import type { RepositorySnapshot } from "@pidesk/shared";
import { PanelLeft, Plus, Settings } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ProjectAvatar } from "./project-avatar";

export interface LeftRailProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  onSelectRepository: (repositoryId: string) => void;
  onAddRepository: () => void;
  onOpenSettings: () => void;
  onToggleSidebar?: () => void;
  isSidebarVisible?: boolean;
}

export function LeftRail({
  repositories,
  activeRepositoryId,
  onSelectRepository,
  onAddRepository,
  onOpenSettings,
  onToggleSidebar,
  isSidebarVisible,
}: LeftRailProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-16 shrink-0 flex-col border-r border-border bg-surface-1",
      )}
    >
      {/* Project avatars area */}
      <div className="flex flex-1 flex-col gap-[1px] overflow-y-auto py-2">
        {repositories.map((repository) => (
          <ProjectAvatar
            key={repository.id}
            repository={repository}
            isActive={repository.id === activeRepositoryId}
            onClick={() => onSelectRepository(repository.id)}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-2 border-t border-border px-2 py-3">
        {!isSidebarVisible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            onClick={() => onToggleSidebar?.()}
            aria-label="Show sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        ) : null}
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
