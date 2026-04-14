import { Folder, Plus, Stack } from "@phosphor-icons/react";
import type { RepositorySnapshot } from "@pidesk/shared";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

function getPathTail(value: string): string {
  const segments = value.split(/[\\/]+/).filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

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

export function RepositorySwitcher({
  repositories,
  activeRepositoryId,
  onSelect,
  onAdd,
  triggerLabel: _triggerLabel,
  triggerSubtitle: _triggerSubtitle,
  triggerAriaLabel,
  className,
}: RepositorySwitcherProps) {
  const triggerTitle = triggerAriaLabel ?? "Switch projects";

  return (
    <TooltipProvider>
      <Popover>
        <PopoverTrigger asChild>
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={triggerTitle}
                  className={cn(
                    "group flex size-8 items-center justify-center rounded-sm text-left",
                    "text-white/70 transition-colors duration-[var(--duration-fast)] hover:bg-white/[0.04] hover:text-white/90",
                    className,
                  )}
                >
                  <Stack
                    className="size-4 shrink-0 text-white/30 group-hover:text-white/50 transition-colors"
                    weight="regular"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {triggerTitle}
              </TooltipContent>
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden border border-white/[0.06] bg-[#111111] rounded-md"
        >
          <div className="flex flex-col">
            {repositories.map((repository) => {
              const isSelected = repository.id === activeRepositoryId;

              return (
                <button
                  key={repository.id}
                  type="button"
                  onClick={() => onSelect(repository.id)}
                  className={cn(
                    "active-accent-left flex w-full items-center gap-2 border-b border-white/[0.04] px-3 py-2.5 text-left transition-all duration-[var(--duration-fast)]",
                    "hover:bg-white/[0.04]",
                    isSelected
                      ? "bg-white/[0.06] text-white/80 active"
                      : "text-white/50 hover:text-white/80",
                  )}
                  data-active={isSelected}
                >
                  <Folder
                    className={cn(
                      "size-5 shrink-0 transition-colors",
                      isSelected
                        ? "text-white/70"
                        : "text-white/20 group-hover:text-white/40",
                    )}
                    weight="regular"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-white/80">
                      {repository.customName ?? repository.name}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-white/30">
                      {getPathTail(repository.rootPath)}
                    </div>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onAdd()}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-3 text-[14px] font-medium",
                "text-white/30 transition-all duration-[var(--duration-fast)]",
                "hover:bg-white/[0.04] hover:text-white/80",
              )}
            >
              <Plus className="size-5 shrink-0" weight="bold" />
              Add repository
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
