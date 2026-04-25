import { cn } from "@pi-desktop/ui";
import { Button } from "@/components/ui/button";
import {
  ArrowClockwise,
  CaretDown,
  Check,
  GitBranch,
} from "@/components/ui/phosphor-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  BranchSummary,
  GitPanelCapabilities,
  GitPanelViewModel,
} from "./git-panel-model";

export interface GitPanelHeaderProps {
  viewModel: GitPanelViewModel;
  branches: ReadonlyArray<BranchSummary>;
  capabilities: GitPanelCapabilities;
  canRefresh: boolean;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  onSwitchBranch?: (branchName: string) => void | Promise<void>;
}

export function GitPanelHeader({
  viewModel,
  branches,
  capabilities,
  canRefresh,
  isRefreshing,
  onRefresh,
  onSwitchBranch,
}: GitPanelHeaderProps) {
  return (
    <div className="border-b border-white/[0.06] px-4 py-3 select-none">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {capabilities.listBranches && branches.length > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Switch branch"
                    className="flex items-center gap-1.5 truncate text-[11px] font-normal text-white/50 hover:text-white/80 transition-colors"
                  >
                    <GitBranch className="size-3 shrink-0" />
                    <span className="truncate">{viewModel.branchLabel}</span>
                    <CaretDown className="size-2.5 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  className="w-56 border-white/10 bg-[var(--color-bg-secondary)] p-1 shadow-2xl"
                >
                  <div className="flex flex-col gap-0.5 max-h-64 overflow-auto custom-scrollbar">
                    {branches.map((branch) => (
                      <Button
                        key={branch.name}
                        variant="ghost"
                        size="sm"
                        disabled={
                          !capabilities.switchBranch ||
                          branch.isCurrent ||
                          !onSwitchBranch
                        }
                        onClick={() => void onSwitchBranch?.(branch.name)}
                        className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          {branch.isCurrent ? (
                            <Check className="size-2.5 text-[var(--color-accent)]" />
                          ) : (
                            <span className="size-2.5" />
                          )}
                          <span className="truncate">{branch.name}</span>
                          {branch.isRemote ? (
                            <span className="text-white/50">(remote)</span>
                          ) : null}
                        </span>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <span className="truncate text-[11px] font-normal text-white/50">
                {viewModel.branchLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={!canRefresh || isRefreshing}
              aria-label="Refresh git status"
              className="flex size-8 items-center justify-center text-white/40 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowClockwise
                className={cn("size-4", isRefreshing && "animate-spin")}
              />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] tabular-nums tracking-wide text-white/40">
          <span className="truncate font-normal">{viewModel.summary}</span>
          <span className="text-white/45 select-none">·</span>
          <span className="truncate">{viewModel.syncLabel}</span>
        </div>
      </div>
    </div>
  );
}
