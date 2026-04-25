import type {
  GitFileDiff,
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import { GitDiffViewer } from "./git-diff-viewer";
import { CombinedChangeList } from "./git-panel-change-list";
import { GitPanelCommitComposer } from "./git-panel-commit-composer";
import { GitPanelHeader } from "./git-panel-header";
import {
  type BranchSummary,
  buildFileStageEntries,
  buildGitPanelViewModel,
  type CommitTemplate,
  DEFAULT_COMMIT_TEMPLATES,
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
        <GitPanelHeader
          viewModel={viewModel}
          branches={branches}
          capabilities={capabilities}
          canRefresh={canRefresh}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          onSwitchBranch={onSwitchBranch}
        />

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
                <GitPanelCommitComposer
                  repositoryPath={repositoryPath}
                  commitMessage={commitMessage}
                  isLoading={isLoading}
                  commitTemplates={commitTemplates}
                  canCommit={canCommit}
                  canCommitAndPush={canCommitAndPush}
                  canPull={canPull}
                  canPush={canPush}
                  canFetch={canFetch}
                  amend={amend}
                  canAmend={capabilities.amend}
                  onCommitMessageChange={onCommitMessageChange}
                  onCommit={onCommit}
                  onCommitAndPush={onCommitAndPush}
                  onPull={onPull}
                  onPush={onPush}
                  onFetch={onFetch}
                  onAmendChange={onAmendChange}
                />
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
