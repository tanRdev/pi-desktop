import type {
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeSnapshot,
} from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ArrowClockwise, ArrowDown, ArrowUp, Check, Trash } from "../ui/icons";
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
  onPull: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
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
      <div className="px-1 py-8 text-[14px] text-white/10 italic text-center">
        No changes detected
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[14px] font-semibold uppercase tracking-wider text-white/20">
          Changes
        </h3>
        <span className="text-[14px] tabular-nums text-white/15">
          {allPaths.length}
        </span>
      </div>
      <div className="max-h-[500px] overflow-y-auto overflow-x-hidden transition-colors">
        <div className="divide-y divide-white/[0.04]">
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
                className="group flex items-center gap-3 py-2 transition-colors"
              >
                <button
                  type="button"
                  onClick={() =>
                    staged ? void onUnstage(path) : void onStage(path)
                  }
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border transition-all duration-150",
                    staged
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                      : "border-white/10 text-transparent hover:border-white/30",
                  )}
                >
                  <Check className="size-2.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-white/60 group-hover:text-white/80">
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
                      className="size-5 hover:bg-white/[0.05] hover:text-red-400/70"
                    >
                      <Trash className="size-2.5" />
                    </Button>
                  </div>
                  <div
                    className={cn(
                      "w-4 text-center text-[14px] font-bold select-none",
                      status === "added" || status === "untracked"
                        ? "text-emerald-400"
                        : status === "deleted"
                          ? "text-rose-400"
                          : status === "modified"
                            ? "text-amber-400"
                            : status === "renamed"
                              ? "text-sky-400"
                              : "text-white/20",
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
  onPull,
  onPush,
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
  const canPull = repositoryPath !== null && viewModel.pullActionLabel !== null;
  const canPush = repositoryPath !== null && viewModel.pushActionLabel !== null;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-[var(--color-bg-primary)] text-white",
        className,
      )}
    >
      <div className="border-b border-white/[0.04] px-5 py-5 select-none">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="truncate text-[16px] font-semibold text-white/50">
                {projectName ?? worktree?.label}
              </h2>
              <span className="text-white/20 select-none">/</span>
              <span className="truncate text-[16px] font-medium text-white/40">
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
                className="size-6 text-white/20 hover:text-white/60 hover:bg-white/[0.04]"
              >
                <ArrowClockwise
                  className={cn("size-3", isRefreshing && "animate-spin")}
                />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[14px] tabular-nums tracking-wide text-white/30">
            <span className="truncate font-medium">{viewModel.summary}</span>
            <span className="text-white/10 select-none">·</span>
            <span className="truncate">{viewModel.syncLabel}</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="relative rounded-sm border border-white/[0.04] p-1 transition-colors">
              <textarea
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
                placeholder="Commit message..."
                rows={2}
                disabled={!repositoryPath || isLoading}
                className="w-full resize-none rounded-sm border-none bg-transparent px-1 py-1 text-[16px] text-white/80 transition-all duration-150 placeholder:text-white/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center gap-1 pb-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => void onCommit()}
                  disabled={!canCommit || !commitMessage.trim() || isLoading}
                  className="h-6 border-white/[0.06] bg-transparent text-white/50 hover:border-white/[0.12] hover:text-white/80"
                >
                  Commit
                </Button>
                <TooltipProvider>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void onPull()}
                          disabled={!canPull || isLoading}
                          className="size-6 text-white/20 hover:text-white/60"
                          aria-label={viewModel.pullActionLabel ?? "Pull"}
                        >
                          <ArrowDown className="size-3" />
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
                          className="size-6 text-white/20 hover:text-white/60"
                          aria-label={viewModel.pushActionLabel ?? "Push"}
                        >
                          <ArrowUp className="size-3" />
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
