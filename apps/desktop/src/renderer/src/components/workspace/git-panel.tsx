import type {
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ArrowClockwise, CaretDown, Check, Trash } from "../ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
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
  onStageAllFiles: (filePaths: string[]) => void | Promise<void>;
  onUnstageFile: (filePath: string) => void | Promise<void>;
  onUnstageAllFiles: (filePaths: string[]) => void | Promise<void>;
  onDiscardFile: (filePath: string) => void | Promise<void>;
}

function CombinedChangeList({
  repositoryStatus,
  onStage,
  onStageAll,
  onUnstage,
  onUnstageAll,
  onDiscard,
}: {
  repositoryStatus: GitRepositoryStatus | null;
  onStage: (filePath: string) => void | Promise<void>;
  onStageAll: (filePaths: string[]) => void | Promise<void>;
  onUnstage: (filePath: string) => void | Promise<void>;
  onUnstageAll: (filePaths: string[]) => void | Promise<void>;
  onDiscard: (filePath: string) => void | Promise<void>;
}) {
  const stagedPaths = React.useMemo(
    () => repositoryStatus?.stagedChanges.map((change) => change.path) ?? [],
    [repositoryStatus],
  );
  const unstagedPaths = React.useMemo(
    () => repositoryStatus?.unstagedChanges.map((change) => change.path) ?? [],
    [repositoryStatus],
  );
  const allPaths = React.useMemo(() => {
    const paths = new Set<string>();
    stagedPaths.forEach((path) => {
      paths.add(path);
    });
    unstagedPaths.forEach((path) => {
      paths.add(path);
    });
    return Array.from(paths).sort();
  }, [stagedPaths, unstagedPaths]);

  const { added, deleted, modified } = React.useMemo(() => {
    let a = 0;
    let d = 0;
    let m = 0;
    allPaths.forEach((path) => {
      const staged = repositoryStatus?.stagedChanges.find(
        (c) => c.path === path,
      );
      const unstaged = repositoryStatus?.unstagedChanges.find(
        (c) => c.path === path,
      );
      const status = (unstaged || staged)?.status ?? "unknown";
      if (status === "added" || status === "untracked") a++;
      else if (status === "deleted") d++;
      else if (status === "modified" || status === "renamed") m++;
    });
    return { added: a, deleted: d, modified: m };
  }, [allPaths, repositoryStatus]);

  if (allPaths.length === 0) {
    return null;
  }

  const handleStageAll = () => {
    void onStageAll(unstagedPaths);
  };

  const handleUnstageAll = () => {
    void onUnstageAll(stagedPaths);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] text-white/50">Changes</h3>
          <div className="flex items-center gap-1.5 text-[10px]">
            <button
              type="button"
              onClick={handleStageAll}
              disabled={unstagedPaths.length === 0}
              className="text-white/40 transition-colors duration-150 hover:text-white/80 disabled:cursor-not-allowed disabled:text-white/20"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={handleUnstageAll}
              disabled={stagedPaths.length === 0}
              className="text-white/40 transition-colors duration-150 hover:text-white/80 disabled:cursor-not-allowed disabled:text-white/20"
            >
              Deselect all
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
          {added > 0 && (
            <span className="flex items-center justify-center rounded bg-emerald-500/10 px-1 py-px text-emerald-400 text-[10px]">
              +{added}
            </span>
          )}
          {modified > 0 && (
            <span className="flex items-center justify-center rounded bg-amber-500/10 px-1 py-px text-amber-400 text-[10px]">
              ~{modified}
            </span>
          )}
          {deleted > 0 && (
            <span className="flex items-center justify-center rounded bg-rose-500/10 px-1 py-px text-rose-400 text-[10px]">
              -{deleted}
            </span>
          )}
          {added === 0 &&
            modified === 0 &&
            deleted === 0 &&
            allPaths.length > 0 && (
              <span className="flex items-center justify-center rounded bg-white/5 px-1 py-px text-white/40 text-[10px]">
                {allPaths.length}
              </span>
            )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
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
                className="group flex w-full items-center gap-1.5 px-2 py-1 text-left text-[10px] transition-colors text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              >
                <button
                  type="button"
                  onClick={() =>
                    staged ? void onUnstage(path) : void onStage(path)
                  }
                  aria-label={staged ? `Unstage ${path}` : `Stage ${path}`}
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border transition-all duration-200",
                    staged
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                      : "border-white/10 text-transparent hover:border-white/30",
                  )}
                >
                  <Check className="size-2" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate group-hover:text-white/80">
                    {path}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => void onDiscard(path)}
                      title="Discard changes"
                      className={cn(
                        "flex size-4 items-center justify-center rounded text-white/35 transition-colors duration-150",
                        "hover:bg-red-500/20 hover:text-red-400",
                      )}
                    >
                      <Trash className="size-2" />
                    </button>
                  </div>
                  <div
                    className={cn(
                      "w-3 text-center text-[10px] font-bold select-none font-mono",
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

function GitPanelSkeleton() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="h-8 w-full rounded bg-white/5" />
        <div className="flex gap-2">
          <div className="h-7 w-16 rounded bg-white/5" />
          <div className="h-7 w-7 rounded bg-white/5" />
        </div>
      </section>
      <div className="space-y-2">
        <div className="h-4 w-20 rounded bg-white/5" />
        <div className="h-8 w-full rounded bg-white/5" />
        <div className="h-8 w-full rounded bg-white/5" />
      </div>
    </div>
  );
}

export function GitPanel({
  className,
  projectName: _projectName,
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
  onStageAllFiles,
  onUnstageFile,
  onUnstageAllFiles,
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
    <Skeleton
      name="git-panel"
      loading={isLoading}
      fixture={<GitPanelSkeleton />}
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col bg-[var(--color-bg-primary)] text-white",
          className,
        )}
      >
        <div className="border-b border-white/[0.06] px-4 py-3 select-none">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-[12px] font-medium text-white/50">
                  {viewModel.branchLabel}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void onRefresh()}
                  disabled={!canRefresh || isRefreshing}
                  className="flex size-8 items-center justify-center rounded-sm text-white/40 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowClockwise
                    className={cn("size-4", isRefreshing && "animate-spin")}
                  />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[12px] tabular-nums tracking-wide text-white/40">
              <span className="truncate font-medium">{viewModel.summary}</span>
              <span className="text-white/20 select-none">·</span>
              <span className="truncate">{viewModel.syncLabel}</span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            <section>
              <textarea
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
                placeholder="Commit message..."
                rows={2}
                disabled={!repositoryPath || isLoading}
                className="w-full resize-none bg-transparent px-0 py-2 text-[12px] leading-relaxed text-white/90 placeholder:text-white/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={
                        !canCommit || !commitMessage.trim() || isLoading
                      }
                    >
                      <span>Commit</span>
                      <CaretDown className="size-2.5 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    side="bottom"
                    className="w-48 border-white/10 bg-[#161616] p-1 shadow-2xl"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          !canCommit || !commitMessage.trim() || isLoading
                        }
                        onClick={() => void onCommit()}
                        className="justify-start px-2 py-1.5 text-[12px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                      >
                        Commit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          !canCommitAndPush ||
                          !commitMessage.trim() ||
                          isLoading
                        }
                        onClick={() => void onCommitAndPush()}
                        className="justify-start px-2 py-1.5 text-[12px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                      >
                        Commit & Push
                      </Button>
                      <div className="my-1 h-px bg-white/5" />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canPush || isLoading}
                        onClick={() => void onPush()}
                        className="justify-start px-2 py-1.5 text-[12px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                      >
                        Push
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canPull || isLoading}
                        onClick={() => void onPull()}
                        className="justify-start px-2 py-1.5 text-[12px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                      >
                        Pull
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canFetch || isLoading}
                        onClick={() => void onFetch()}
                        className="justify-start px-2 py-1.5 text-[12px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                      >
                        Fetch
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </section>

            <div className="space-y-5">
              <CombinedChangeList
                repositoryStatus={repositoryStatus}
                onStage={onStageFile}
                onStageAll={onStageAllFiles}
                onUnstage={onUnstageFile}
                onUnstageAll={onUnstageAllFiles}
                onDiscard={onDiscardFile}
              />
            </div>
          </div>
        </div>
      </div>
    </Skeleton>
  );
}
