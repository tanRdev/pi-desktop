import type { RepositorySnapshot } from "@pidesk/shared";
import { ChevronDown, FolderGit, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";
import { GitStatusChip } from "./git-status-chip";

export interface RepositorySwitcherProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  onSelect: (repositoryId: string) => void | Promise<void>;
  onAdd: () => void | Promise<void>;
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
}: RepositorySwitcherProps) {
  const activeRepository = getActiveRepository(repositories, activeRepositoryId);
  const activeWorktree =
    activeRepository?.worktrees.find((worktree) => worktree.id === activeRepositoryId) ??
    activeRepository?.worktrees[0] ??
    null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between rounded border border-border bg-surface-2 px-3 py-2 text-left text-sm font-medium text-foreground shadow-sm transition hover:border-border-hover hover:bg-surface-3"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate">{activeRepository?.name ?? "Add a repository"}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {activeWorktree?.path ?? "No repository selected"}
            </div>
          </div>
          <ChevronDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] rounded border border-border bg-popover p-2 shadow-lg"
      >
        <div className="space-y-1">
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
                className="flex w-full items-start gap-3 rounded px-2 py-2 text-left text-sm transition hover:bg-surface-3"
              >
                <FolderGit className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    {repository.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {repository.rootPath}
                  </div>
                </div>
                {repositoryWorktree && <GitStatusChip git={repositoryWorktree.git} />}
              </button>
            );
          })}
          {repositories.length > 0 && <Separator className="my-1" />}
          <button
            type="button"
            onClick={() => onAdd()}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground transition hover:bg-surface-3"
          >
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            Add Repository
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
