import type {
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  CaretDown,
  Check,
  Trash,
} from "../ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { buildGitPanelViewModel } from "./git-panel-model";

export {
  buildGitPanelViewModel,
  formatGitCountsSummary,
} from "./git-panel-model";

export interface GitPanelProps {
  className?: string;
  projectName?: string;
  repositoryPath: string | null;
  worktree: WorktreeSnapshot | null;
  repositoryStatus: GitRepositoryStatus | null;
  shellGit: ShellGitSnapshot | null;
  commitMessage: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onCommitMessageChange: (value: string) => void;
  onRefresh: () => void | Promise<void>;
  onCommit: () => void | Promise<void>;
  onCommitAndPush: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
  onFetch: () => void | Promise<void>;
  onStageFile: (filePath: string) => void | Promise<void>;
  onUnstageFile: (filePath: string) => void | Promise<void>;
  onDiscardFile: (filePath: string) => void | Promise<void>;
}

function CombinedChangeList({
  repositoryStatus,
  onStage,
  onUnstage,
  onDiscard,
}: {
  repositoryStatus: GitRepositoryStatus | null;
  onStage: (filePath: string) => void | Promise<void>;
  onUnstage: (filePath: string) => void | Promise<void>;
  onDiscard: (filePath: string) => void | Promise<void>;
}) {
  const allPaths = React.useMemo(() => {
    const paths = new Set<string>();
    repositoryStatus?.stagedChanges.forEach((c) => {
      paths.add(c.path);
    });
    repositoryStatus?.unstagedChanges.forEach((c) => {
      paths.add(c.path);
    });
    return Array.from(paths).sort();
  }, [repositoryStatus]);

  if (allPaths.length === 0) {
    return (
      <div className="px-1 py-10 text-[13px] text-white/30 italic text-center">
        No changes detected
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-white/40">
          Changes
        </h3>
        <span className="text-[12px] font-mono text-white/30">
          {allPaths.length}
        </span>
      </div>
      <div className="max-h-[500px] overflow-y-auto overflow-x-hidden transition-colors custom-scrollbar">
        <div className="divide-y divide-white/[0.06]">
          {allPaths.map((path) => {
            const staged = repositoryStatus?.stagedChanges.find(
              (c) => c.path === path,
            );
            const unstaged = repositoryStatus?.unstagedChanges.find(
              (c) => c.path === path,
            );
            const status = (unstaged || staged)?.status ?? "unknown";

            return (
              <div
                key={path}
                className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() =>
                    staged ? void onUnstage(path) : void onStage(path)
                  }
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border transition-all duration-200",
                    staged
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                      : "border-white/10 text-transparent hover:border-white/30",
                  )}
                >
                  <Check className="size-3" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-white/70 group-hover:text-white/90">
                    {path}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => void onDiscard(path)}
                      className="size-6 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash className="size-3" />
                    </Button>
                  </div>
                  <div
                    className={cn(
                      "w-4 text-center text-[12px] font-bold select-none font-mono",
                      status === "added" || status === "untracked"
                        ? "text-emerald-400"
                        : status === "deleted"
                          ? "text-rose-400"
                          : status === "modified"
                            ? "text-amber-400"
                            : status === "renamed"
                              ? "text-sky-400"
                              : "text-white/30",
                    )}
                  >
                    {status === "added" || status === "untracked"
                      ? "+"
                      : status === "deleted"
                        ? "-"
                        : status === "modified"
                          ? "M"
                          : status === "renamed"
                            ? "R"
                            : "•"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function GitPanel({
  className,
  projectName,
  repositoryPath,
  worktree,
  repositoryStatus,
  shellGit,
  commitMessage,
  isLoading = false,
  isRefreshing = false,
  onCommitMessageChange,
  onRefresh,
  onCommit,
  onCommitAndPush,
  onPull,
  onPush,
  onFetch,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
}: GitPanelProps) {
  const viewModel = React.useMemo(
    () =>
      buildGitPanelViewModel({
        worktree,
        repositoryStatus,
        repositoryPath,
        shellGit,
      }),
    [repositoryPath, repositoryStatus, shellGit, worktree],
  );
  const canRefresh =
    repositoryPath !== null && shellGit?.status === "repository";
  const canCommit =
    repositoryPath !== null && viewModel.commitActionLabel !== null;
  const canCommitAndPush =
    repositoryPath !== null && viewModel.commitAndPushActionLabel !== null;
  const canPull = repositoryPath !== null && viewModel.pullActionLabel !== null;
  const canPush = repositoryPath !== null && viewModel.pushActionLabel !== null;
  const canFetch =
    repositoryPath !== null && viewModel.fetchActionLabel !== null;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-[var(--color-bg-primary)] text-white",
        className,
      )}
    >
      <div className="border-b border-white/[0.08] px-5 py-5 select-none bg-white/[0.01]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="truncate text-[16px] font-semibold text-white/70">
                {projectName ?? worktree?.label}
              </h2>
              <span className="text-white/20 select-none">/</span>
              <span className="truncate text-[16px] font-medium text-white/50">
                {viewModel.branchLabel}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => void onRefresh()}
                disabled={!canRefresh || isRefreshing}
                className="size-7 text-white/30 hover:text-white/80 hover:bg-white/[0.06]"
              >
                <ArrowClockwise
                  className={cn("size-3.5", isRefreshing && "animate-spin")}
                />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[13px] tabular-nums tracking-wide text-white/40">
            <span className="truncate font-medium">{viewModel.summary}</span>
            <span className="text-white/20 select-none">·</span>
            <span className="truncate">{viewModel.syncLabel}</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="relative rounded-md border border-white/10 bg-white/[0.02] p-1 transition-all focus-within:border-white/20 focus-within:bg-white/[0.04]">
              <textarea
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
                placeholder="Commit message..."
                rows={2}
                disabled={!repositoryPath || isLoading}
                className="w-full resize-none rounded-md border-none bg-transparent px-2 py-2 text-[14px] leading-relaxed text-white/90 transition-all duration-150 placeholder:text-white/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center gap-1 p-1 pt-0">
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => void onCommit()}
                    disabled={!canCommit || !commitMessage.trim() || isLoading}
                    className="h-7 rounded-r-none border-r border-white/10 bg-white/[0.05] px-3 text-[13px] font-medium text-white/70 hover:bg-white/[0.1] hover:text-white disabled:bg-transparent"
                  >
                    Commit
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={!repositoryPath || isLoading}
                        className="h-7 w-6 rounded-l-none bg-white/[0.05] text-white/40 hover:bg-white/[0.1] hover:text-white/70 disabled:bg-transparent"
                      >
                        <CaretDown className="size-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="bottom"
                      className="w-48 border-white/10 bg-[#161616] p-1 shadow-2xl"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            !canCommitAndPush ||
                            !commitMessage.trim() ||
                            isLoading
                          }
                          onClick={() => void onCommitAndPush()}
                          className="justify-start px-2 py-1.5 text-[13px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          Commit & Push
                        </Button>
                        <div className="my-1 h-px bg-white/5" />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canPush || isLoading}
                          onClick={() => void onPush()}
                          className="justify-start px-2 py-1.5 text-[13px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          Push
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canPull || isLoading}
                          onClick={() => void onPull()}
                          className="justify-start px-2 py-1.5 text-[13px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          Pull
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canFetch || isLoading}
                          onClick={() => void onFetch()}
                          className="justify-start px-2 py-1.5 text-[13px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          Fetch
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <TooltipProvider>
                  <div className="ml-auto flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void onPull()}
                          disabled={!canPull || isLoading}
                          className="size-7 text-white/30 hover:bg-white/[0.05] hover:text-white/70"
                          aria-label={viewModel.pullActionLabel ?? "Pull"}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {viewModel.pullActionLabel ?? "Pull"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void onPush()}
                          disabled={!canPush || isLoading}
                          className="size-7 text-white/30 hover:bg-white/[0.05] hover:text-white/70"
                          aria-label={viewModel.pushActionLabel ?? "Push"}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {viewModel.pushActionLabel ?? "Push"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>
            </div>
          </section>

          <div className="space-y-5">
            <CombinedChangeList
              repositoryStatus={repositoryStatus}
              onStage={onStageFile}
              onUnstage={onUnstageFile}
              onDiscard={onDiscardFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
