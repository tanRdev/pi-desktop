import type { RepositorySnapshot } from "@pidesk/shared";
import { ChevronDown, FolderGit, Plus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
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
        <Button
          variant="ghost"
          className={cn(
            "h-auto w-full justify-between rounded-none border border-[#474747]/30 bg-[#0e0e0e] px-3 py-2 text-left text-[11px] font-mono uppercase tracking-wider text-white shadow-none",
            "transition-all duration-100 hover:bg-[#131313] hover:border-[#474747]",
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold tracking-[0.1em]">
              {activeRepository?.name ?? "ADD_REPO"}
            </div>
            <div className="mt-0.5 truncate text-[9px] text-[#474747] font-mono">
              {activeWorktree?.path ?? "NULL_TARGET"}
            </div>
          </div>
          <ChevronDown className="ml-2 size-3 shrink-0 text-[#474747]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] rounded-none border border-[#474747]/40 bg-[#131313] p-0 shadow-none overflow-hidden"
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
                  "flex w-full items-start gap-3 border-b border-[#474747]/10 px-3 py-2.5 text-left text-[11px] font-mono transition-all duration-75",
                  "hover:bg-[#353535] hover:text-white group",
                  repository.id === activeRepositoryId
                    ? "bg-[#0e0e0e]"
                    : "text-[#474747]",
                )}
              >
                <FolderGit className="mt-0.5 size-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold uppercase tracking-widest text-inherit">
                    {repository.name}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] text-inherit opacity-60">
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
              "flex w-full items-center gap-2 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#474747] transition-all hover:bg-[#353535] hover:text-white",
            )}
          >
            <Plus className="size-3.5 shrink-0" />
            ADD REPOSITORY
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
