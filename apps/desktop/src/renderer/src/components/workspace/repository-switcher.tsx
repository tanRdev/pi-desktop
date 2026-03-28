import type { RepositorySnapshot } from "@pidesk/shared";
import { FolderGit, Plus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { GitStatusChip } from "./git-status-chip";

export interface RepositorySwitcherProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  onSelect: (repositoryId: string) => void | Promise<void>;
  onAdd: () => void | Promise<void>;
  triggerLabel?: string;
  triggerSubtitle?: string;
  triggerAriaLabel?: string;
  className?: string;
}

function getActiveRepository(
  repositories: RepositorySnapshot[],
  activeRepositoryId: string | null,
): RepositorySnapshot | null {
  return (
    repositories.find((repository) => repository.id === activeRepositoryId) ??
    repositories[0] ??
    null
  );
}

export function RepositorySwitcher({
  repositories,
  activeRepositoryId,
  onSelect,
  onAdd,
  triggerLabel,
  triggerSubtitle,
  triggerAriaLabel,
  className,
}: RepositorySwitcherProps) {
  const activeRepository = getActiveRepository(
    repositories,
    activeRepositoryId,
  );
  const activeWorktree =
    activeRepository?.worktrees.find(
      (worktree) => worktree.id === activeRepositoryId,
    ) ??
    activeRepository?.worktrees[0] ??
    null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerAriaLabel}
          className={cn(
            "flex h-auto w-full items-start justify-between gap-3 py-0.5 text-left text-foreground",
            "transition-opacity duration-150 hover:opacity-80",
            className,
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {triggerLabel ?? activeRepository?.name ?? "Select project"}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {triggerSubtitle ?? activeWorktree?.path ?? ""}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden"
      >
        <div className="flex flex-col">
          {repositories.map((repository) => {
            const repositoryWorktree =
              repository.worktrees.find((worktree) => worktree.isMain) ??
              repository.worktrees[0] ??
              null;

            return (
              <button
                key={repository.id}
                type="button"
                onClick={() => onSelect(repository.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-[#2a2a2a] px-3 py-2.5 text-left text-sm transition-colors",
                  "hover:bg-[#1a1a1a] group",
                  repository.id === activeRepositoryId
                    ? "bg-[#1a1a1a] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FolderGit className="mt-0.5 size-4 shrink-0 opacity-50 group-hover:opacity-100" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{repository.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {repository.rootPath}
                  </div>
                </div>
                {repositoryWorktree && (
                  <GitStatusChip git={repositoryWorktree.git} />
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onAdd()}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground",
              "transition-colors hover:bg-[#1a1a1a] hover:text-foreground",
            )}
          >
            <Plus className="size-4 shrink-0" />
            Add repository
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
