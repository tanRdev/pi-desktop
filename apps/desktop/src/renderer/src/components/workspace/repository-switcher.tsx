import { Folder, Plus, Stack } from "@phosphor-icons/react";
import type { RepositorySnapshot } from "@pidesk/shared";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

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
            "group flex h-auto w-full items-center justify-between gap-2 py-0.5 text-left",
            "transition-all duration-[var(--duration-fast)] hover:opacity-80",
            className,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Stack
              className="size-4 shrink-0 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] transition-colors"
              weight="regular"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                {triggerLabel ?? activeRepository?.name ?? "Select project"}
              </div>
              <div className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                {triggerSubtitle ?? activeWorktree?.path ?? ""}
              </div>
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
      >
        <div className="flex flex-col">
          {repositories.map((repository) => {
            const repositoryWorktree =
              repository.worktrees.find((worktree) => worktree.isMain) ??
              repository.worktrees[0] ??
              null;
            const isSelected = repository.id === activeRepositoryId;

            return (
              <button
                key={repository.id}
                type="button"
                onClick={() => onSelect(repository.id)}
                className={cn(
                  "active-accent-left flex w-full items-center gap-2 border-b border-[var(--color-border-default)] px-3 py-2.5 text-left transition-all duration-[var(--duration-fast)]",
                  "hover:bg-[var(--color-bg-hover)]",
                  isSelected
                    ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] active"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                )}
                data-active={isSelected}
              >
                <Folder
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isSelected
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-quaternary)] group-hover:text-[var(--color-text-tertiary)]",
                  )}
                  weight="regular"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {repository.name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-tertiary)]">
                    {repository.rootPath}
                  </div>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onAdd()}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-3 text-[13px] font-medium",
              "text-[var(--color-text-tertiary)] transition-all duration-[var(--duration-fast)]",
              "hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
            )}
          >
            <Plus className="size-4 shrink-0" weight="bold" />
            Add repository
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
