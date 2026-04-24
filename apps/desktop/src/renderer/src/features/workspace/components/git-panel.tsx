import type {
  GitFileDiff,
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CaretDown,
  Check,
  Copy,
  GitBranch,
  Trash,
} from "@/components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { GitDiffViewer } from "./git-diff-viewer";
import {
  applyCommitTemplate,
  type BranchSummary,
  buildFileStageEntries,
  buildGitPanelViewModel,
  type CommitTemplate,
  DEFAULT_COMMIT_TEMPLATES,
  type FileStageEntry,
  type GitPanelCapabilities,
  NO_GIT_CAPABILITIES,
  nextFocusIndex,
} from "./git-panel-model";

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
  /**
   * Optional capability flags. Components gate UI behind these booleans for
   * features whose backend IPC may not be wired yet (amend, revert, branch
   * switching, etc). Defaults to {@link NO_GIT_CAPABILITIES}.
   */
  capabilities?: GitPanelCapabilities;
  /** Available commit-message templates. Defaults to {@link DEFAULT_COMMIT_TEMPLATES}. */
  commitTemplates?: ReadonlyArray<CommitTemplate>;
  /** Branch list (frontend-only until backend IPC wired). */
  branches?: ReadonlyArray<BranchSummary>;
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
  onViewDiff?: (filePath: string, staged: boolean) => void;
  /** Per-file revert. Called only when `capabilities.revertFile` is true. */
  onRevertFile?: (filePath: string) => void | Promise<void>;
  /** Amend toggle change. Called only when `capabilities.amend` is true. */
  onAmendChange?: (amend: boolean) => void;
  /** Initial amend state. */
  amend?: boolean;
  /** Branch switch. Called only when `capabilities.switchBranch` is true. */
  onSwitchBranch?: (branchName: string) => void | Promise<void>;
}

interface GitChangeRowProps {
  path: string;
  isStaged: boolean;
  status: string;
  isFocused: boolean;
  canRevert: boolean;
  onStage: (filePath: string) => void | Promise<void>;
  onUnstage: (filePath: string) => void | Promise<void>;
  onDiscard: (filePath: string) => void | Promise<void>;
  onRevert?: (filePath: string) => void | Promise<void>;
  onSelectFile?: (filePath: string, staged: boolean) => void;
  onCopyPath: (filePath: string) => void;
  onFocusRow: (filePath: string) => void;
}

const GitChangeRow = React.memo(function GitChangeRow({
  path,
  isStaged,
  status,
  isFocused,
  canRevert,
  onStage,
  onUnstage,
  onDiscard,
  onRevert,
  onSelectFile,
  onCopyPath,
  onFocusRow,
}: GitChangeRowProps) {
  return (
    <div
      data-path={path}
      data-focused={isFocused ? "true" : "false"}
      className={cn(
        "group flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] transition-colors text-white/40 hover:bg-white/[0.06] hover:text-white/70 border-b border-white/[0.06]",
        isFocused && "bg-white/[0.06] text-white/80",
      )}
    >
      <button
        type="button"
        onClick={() => (isStaged ? void onUnstage(path) : void onStage(path))}
        aria-label={isStaged ? `Unstage ${path}` : `Stage ${path}`}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center border transition-all duration-200",
          isStaged
            ? "bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50 text-[var(--color-accent)]"
            : "border-white/10 text-transparent hover:border-white/30",
        )}
      >
        <Check className="size-2" />
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="truncate group-hover:text-white/80 text-left w-full"
          onClick={() => {
            onFocusRow(path);
            onSelectFile?.(path, isStaged);
          }}
        >
          {path}
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 data-[focused=true]:opacity-100">
          <button
            type="button"
            onClick={() => onCopyPath(path)}
            title="Copy path"
            aria-label={`Copy path ${path}`}
            className={cn(
              "flex size-4 items-center justify-center text-white/50 transition-colors duration-150",
              "hover:bg-white/10 hover:text-white/80",
            )}
          >
            <Copy className="size-2" />
          </button>
          {canRevert && onRevert ? (
            <button
              type="button"
              onClick={() => void onRevert(path)}
              title="Revert file"
              aria-label={`Revert ${path}`}
              className={cn(
                "flex size-4 items-center justify-center text-white/50 transition-colors duration-150",
                "hover:bg-amber-500/20 hover:text-amber-300",
              )}
            >
              <ArrowCounterClockwise className="size-2" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onDiscard(path)}
            title="Discard changes"
            aria-label={`Discard ${path}`}
            className={cn(
              "flex size-4 items-center justify-center text-white/50 transition-colors duration-150",
              "hover:bg-red-500/20 hover:text-red-400",
            )}
          >
            <Trash className="size-2" />
          </button>
        </div>
        <div
          className={cn(
            "w-3 text-center text-[11px] font-bold select-none font-mono",
            status === "added" || status === "untracked"
              ? "text-[var(--color-accent)]"
              : status === "deleted"
                ? "text-rose-400"
                : status === "modified"
                  ? "text-amber-400"
                  : status === "renamed"
                    ? "text-sky-400"
                    : "text-white/50",
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
});

function CombinedChangeList({
  entries,
  focusedPath,
  capabilities,
  onStage,
  onStageAll,
  onUnstage,
  onUnstageAll,
  onDiscard,
  onRevert,
  onSelectFile,
  onCopyPath,
  onFocusRow,
}: {
  entries: ReadonlyArray<FileStageEntry>;
  focusedPath: string | null;
  capabilities: GitPanelCapabilities;
  onStage: (filePath: string) => void | Promise<void>;
  onStageAll: (filePaths: string[]) => void | Promise<void>;
  onUnstage: (filePath: string) => void | Promise<void>;
  onUnstageAll: (filePaths: string[]) => void | Promise<void>;
  onDiscard: (filePath: string) => void | Promise<void>;
  onRevert?: (filePath: string) => void | Promise<void>;
  onSelectFile?: (filePath: string, staged: boolean) => void;
  onCopyPath: (filePath: string) => void;
  onFocusRow: (filePath: string) => void;
}) {
  const { stagedPaths, unstagedPaths, allPaths } = React.useMemo(() => {
    const staged: string[] = [];
    const unstaged: string[] = [];
    entries.forEach((entry) => {
      if (entry.state === "staged" || entry.state === "partial") {
        staged.push(entry.path);
      }
      if (
        entry.state === "unstaged" ||
        entry.state === "partial" ||
        entry.state === "untracked"
      ) {
        unstaged.push(entry.path);
      }
    });
    return {
      stagedPaths: staged,
      unstagedPaths: unstaged,
      allPaths: entries.map((entry) => entry.path),
    };
  }, [entries]);

  const { added, deleted, modified } = React.useMemo(() => {
    let a = 0;
    let d = 0;
    let m = 0;
    entries.forEach((entry) => {
      if (entry.status === "added" || entry.status === "untracked") a++;
      else if (entry.status === "deleted") d++;
      else if (entry.status === "modified" || entry.status === "renamed") m++;
    });
    return { added: a, deleted: d, modified: m };
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  const handleStageAll = () => {
    void onStageAll(unstagedPaths);
  };

  const handleUnstageAll = () => {
    void onUnstageAll(stagedPaths);
  };

  const renderRow = (entry: FileStageEntry) => {
    const isStaged = entry.state === "staged" || entry.state === "partial";
    return (
      <GitChangeRow
        key={entry.path}
        path={entry.path}
        isStaged={isStaged}
        status={entry.status}
        isFocused={focusedPath === entry.path}
        canRevert={capabilities.revertFile}
        onStage={onStage}
        onUnstage={onUnstage}
        onDiscard={onDiscard}
        onRevert={onRevert}
        onSelectFile={onSelectFile}
        onCopyPath={onCopyPath}
        onFocusRow={onFocusRow}
      />
    );
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] text-white/50">Changes</h3>
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={handleStageAll}
              disabled={unstagedPaths.length === 0}
              className="text-white/40 transition-colors duration-150 hover:text-white/80 disabled:cursor-not-allowed disabled:text-white/45"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={handleUnstageAll}
              disabled={stagedPaths.length === 0}
              className="text-white/40 transition-colors duration-150 hover:text-white/80 disabled:cursor-not-allowed disabled:text-white/45"
            >
              Deselect all
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 font-mono text-[11px] font-bold">
          {added > 0 && (
            <span className="flex items-center justify-center bg-[var(--color-accent)]/10 px-1 py-px text-[var(--color-accent)] text-[11px]">
              +{added}
            </span>
          )}
          {modified > 0 && (
            <span className="flex items-center justify-center bg-amber-500/10 px-1 py-px text-amber-400 text-[11px]">
              ~{modified}
            </span>
          )}
          {deleted > 0 && (
            <span className="flex items-center justify-center bg-rose-500/10 px-1 py-px text-rose-400 text-[11px]">
              -{deleted}
            </span>
          )}
          {added === 0 &&
            modified === 0 &&
            deleted === 0 &&
            allPaths.length > 0 && (
              <span className="flex items-center justify-center bg-white/5 px-1 py-px text-white/40 text-[11px]">
                {allPaths.length}
              </span>
            )}
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-hidden"
        style={{ height: Math.min(entries.length * 28, 400) }}
      >
        {entries.length > 50 ? (
          <Virtuoso
            data={entries.slice()}
            className="custom-scrollbar"
            itemContent={(_index, entry) => renderRow(entry)}
          />
        ) : (
          <div className="custom-scrollbar h-full overflow-auto">
            {entries.map((entry) => renderRow(entry))}
          </div>
        )}
      </div>
    </section>
  );
}

function GitPanelSkeleton() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="h-8 w-full bg-white/5" />
        <div className="flex gap-2">
          <div className="h-7 w-16 bg-white/5" />
          <div className="h-7 w-7 bg-white/5" />
        </div>
      </section>
      <div className="space-y-2">
        <div className="h-4 w-20 bg-white/5" />
        <div className="h-8 w-full bg-white/5" />
        <div className="h-8 w-full bg-white/5" />
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
  capabilities = NO_GIT_CAPABILITIES,
  commitTemplates = DEFAULT_COMMIT_TEMPLATES,
  branches = [],
  amend = false,
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
  onViewDiff,
  onRevertFile,
  onAmendChange,
  onSwitchBranch,
}: GitPanelProps) {
  const [selectedDiff, setSelectedDiff] = React.useState<GitFileDiff | null>(
    null,
  );
  const [diffLoading, setDiffLoading] = React.useState(false);
  const [focusIndex, setFocusIndex] = React.useState(0);
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);

  const entries = React.useMemo(
    () => buildFileStageEntries(repositoryStatus),
    [repositoryStatus],
  );

  // Clamp focus when list shrinks.
  React.useEffect(() => {
    if (entries.length === 0) {
      if (focusIndex !== 0) setFocusIndex(0);
      return;
    }
    if (focusIndex >= entries.length) {
      setFocusIndex(entries.length - 1);
    }
  }, [entries.length, focusIndex]);

  const focusedPath =
    entries.length > 0
      ? (entries[Math.max(0, Math.min(focusIndex, entries.length - 1))]?.path ??
        null)
      : null;

  const handleFocusRow = React.useCallback(
    (filePath: string) => {
      const idx = entries.findIndex((e) => e.path === filePath);
      if (idx >= 0) setFocusIndex(idx);
    },
    [entries],
  );

  const handleCopyPath = React.useCallback((filePath: string) => {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (!nav?.clipboard) return;
    void nav.clipboard.writeText(filePath).catch(() => {
      // Clipboard access can be denied in tests or locked-down contexts.
    });
  }, []);

  const handleSelectFile = React.useCallback(
    (filePath: string, staged: boolean) => {
      if (onViewDiff) {
        onViewDiff(filePath, staged);
        return;
      }
      if (!repositoryPath) return;
      setDiffLoading(true);
      window.piDesktop.git
        .diffFile(repositoryPath, filePath, staged)
        .then((diff) => {
          setSelectedDiff(diff);
        })
        .catch(() => {
          setSelectedDiff(null);
        })
        .finally(() => {
          setDiffLoading(false);
        });
    },
    [repositoryPath, onViewDiff],
  );

  const handleCloseDiff = React.useCallback(() => {
    setSelectedDiff(null);
  }, []);

  const handleListKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (entries.length === 0) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setFocusIndex((idx) => nextFocusIndex(idx, entries.length, 1));
        return;
      }
      if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setFocusIndex((idx) => nextFocusIndex(idx, entries.length, -1));
        return;
      }
      const active = entries[focusIndex];
      if (!active) return;
      if (event.key === "Enter") {
        event.preventDefault();
        const isStaged =
          active.state === "staged" || active.state === "partial";
        handleSelectFile(active.path, isStaged);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        const isStaged =
          active.state === "staged" || active.state === "partial";
        if (isStaged) {
          void onUnstageFile(active.path);
        } else {
          void onStageFile(active.path);
        }
      }
    },
    [entries, focusIndex, handleSelectFile, onStageFile, onUnstageFile],
  );

  const handleApplyTemplate = React.useCallback(
    (template: CommitTemplate) => {
      onCommitMessageChange(applyCommitTemplate(commitMessage, template));
    },
    [commitMessage, onCommitMessageChange],
  );

  const handleToggleAmend = React.useCallback(() => {
    onAmendChange?.(!amend);
  }, [amend, onAmendChange]);

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
    repositoryPath !== null && (viewModel.commitActionLabel !== null || amend);
  const canCommitAndPush =
    repositoryPath !== null &&
    (viewModel.commitAndPushActionLabel !== null || amend);
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
                {capabilities.listBranches && branches.length > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Switch branch"
                        className="flex items-center gap-1.5 truncate text-[11px] font-normal text-white/50 hover:text-white/80 transition-colors"
                      >
                        <GitBranch className="size-3 shrink-0" />
                        <span className="truncate">
                          {viewModel.branchLabel}
                        </span>
                        <CaretDown className="size-2.5 shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="bottom"
                      className="w-56 border-white/10 bg-[var(--color-bg-tertiary)] p-1 shadow-2xl"
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

        {selectedDiff ? (
          <GitDiffViewer diff={selectedDiff} onClose={handleCloseDiff} />
        ) : diffLoading ? (
          <div className="flex h-full items-center justify-center text-[11px] text-white/50">
            Loading diff...
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-6">
              <section>
                <textarea
                  value={commitMessage}
                  onChange={(event) =>
                    onCommitMessageChange(event.target.value)
                  }
                  placeholder="Commit message..."
                  rows={2}
                  disabled={!repositoryPath || isLoading}
                  className="w-full resize-none bg-transparent px-0 py-2 text-[11px] leading-relaxed text-white/90 placeholder:text-white/55 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Insert commit template"
                          disabled={!repositoryPath || isLoading}
                          className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span>Template</span>
                          <CaretDown className="size-2.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="bottom"
                        className="w-40 border-white/10 bg-[var(--color-bg-tertiary)] p-1 shadow-2xl"
                      >
                        <div className="flex flex-col gap-0.5 max-h-56 overflow-auto custom-scrollbar">
                          {commitTemplates.map((template) => (
                            <Button
                              key={template.id}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApplyTemplate(template)}
                              className="justify-start px-2 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/[0.05] hover:text-white"
                            >
                              {template.label}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {capabilities.amend ? (
                      <label
                        className={cn(
                          "flex items-center gap-1.5 text-[11px] select-none cursor-pointer",
                          amend ? "text-white/80" : "text-white/40",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={amend}
                          onChange={handleToggleAmend}
                          aria-label="Amend previous commit"
                          className="accent-[var(--color-accent)]"
                        />
                        <span>Amend</span>
                      </label>
                    ) : null}
                  </div>
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
                        <span>{amend ? "Amend" : "Commit"}</span>
                        <CaretDown className="size-2.5 ml-1" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      side="bottom"
                      className="w-48 border-white/10 bg-[var(--color-bg-tertiary)] p-1 shadow-2xl"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            !canCommit || !commitMessage.trim() || isLoading
                          }
                          onClick={() => void onCommit()}
                          className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          {amend ? "Amend" : "Commit"}
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
                          className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          {amend ? "Amend & Push" : "Commit & Push"}
                        </Button>
                        <div className="my-1 h-px bg-white/5" />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canPush || isLoading}
                          onClick={() => void onPush()}
                          className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          Push
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canPull || isLoading}
                          onClick={() => void onPull()}
                          className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          Pull
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canFetch || isLoading}
                          onClick={() => void onFetch()}
                          className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
                        >
                          Fetch
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </section>

              <div
                ref={listContainerRef}
                className="space-y-5 outline-none"
                role="listbox"
                aria-label="Changed files"
                tabIndex={entries.length > 0 ? 0 : -1}
                onKeyDown={handleListKeyDown}
              >
                <CombinedChangeList
                  entries={entries}
                  focusedPath={focusedPath}
                  capabilities={capabilities}
                  onStage={onStageFile}
                  onStageAll={onStageAllFiles}
                  onUnstage={onUnstageFile}
                  onUnstageAll={onUnstageAllFiles}
                  onDiscard={onDiscardFile}
                  onRevert={onRevertFile}
                  onSelectFile={handleSelectFile}
                  onCopyPath={handleCopyPath}
                  onFocusRow={handleFocusRow}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Skeleton>
  );
}
