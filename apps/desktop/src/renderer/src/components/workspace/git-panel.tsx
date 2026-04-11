import type {
  GitRepositoryStatus,
  ShellGitSnapshot,
  WorktreeSnapshot,
} from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  CircleDashed,
  FloppyDisk,
  Trash,
  WarningCircle,
} from "../ui/icons";
import {
  buildGitPanelViewModel,
  type GitPanelStatusTone,
} from "./git-panel-model";
import { GitStatusChip } from "./git-status-chip";

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

function GitPanelStatus({
  tone,
  message,
}: {
  tone: GitPanelStatusTone;
  message: string;
}) {
  const icon =
    tone === "warning" ? (
      <WarningCircle className="size-4 text-yellow-400/50" />
    ) : tone === "neutral" ? (
      <CheckCircle className="size-4 text-emerald-400/50" />
    ) : (
      <CircleDashed className="size-4 text-white/20" />
    );

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-1 py-1 text-[12px] leading-5",
        tone === "warning"
          ? "text-yellow-400/70"
          : tone === "neutral"
            ? "text-emerald-400/70"
            : "text-white/40",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{message}</p>
    </div>
  );
}

function ChangeList({
  title,
  emptyLabel,
  changes,
  actionLabel,
  actionIcon,
  onAction,
  onDiscard,
}: {
  title: string;
  emptyLabel: string;
  changes: GitRepositoryStatus["stagedChanges"];
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: (filePath: string) => void | Promise<void>;
  onDiscard?: (filePath: string) => void | Promise<void>;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/20">
          {title}
        </h3>
        <span className="text-[10px] tabular-nums text-white/15">
          {changes.length}
        </span>
      </div>
      <div className="max-h-[200px] overflow-y-auto overflow-x-hidden transition-colors">
        {changes.length === 0 ? (
          <div className="px-1 py-2 text-[11px] text-white/15 italic">
            {emptyLabel}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {changes.map((change) => (
              <div
                key={`${title}-${change.path}`}
                className="group flex items-center gap-2 py-1.5 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-white/60 group-hover:text-white/80">
                    {change.path}
                  </div>
                  <div className="text-[8px] uppercase tracking-wider text-white/15">
                    {change.status.replaceAll("_", " ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {onDiscard ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onDiscard(change.path)}
                      aria-label={`Discard ${change.path}`}
                      className="size-5 hover:bg-white/[0.05] hover:text-red-400/70"
                    >
                      <Trash className="size-2.5" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onAction(change.path)}
                    className="size-5 text-white/30 hover:bg-white/[0.05] hover:text-white/70"
                  >
                    {actionIcon}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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
        "flex h-full min-h-0 flex-col bg-[#0a0a0a] text-white",
        className,
      )}
    >
      <div className="border-b border-white/[0.04] px-5 py-3 select-none">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <h2 className="truncate text-[13px] font-semibold text-white/90">
              {viewModel.branchLabel}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] tabular-nums tracking-wide text-white/30">
              <span className="truncate">{viewModel.summary}</span>
              <span>·</span>
              <span>{viewModel.syncLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => void onRefresh()}
              disabled={!canRefresh || isRefreshing}
              className="text-white/20 hover:text-white/60"
            >
              <CircleDashed
                className={cn("size-3.5", isRefreshing && "animate-spin")}
              />
            </Button>
            {worktree ? <GitStatusChip git={worktree.git} /> : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="relative p-1 transition-colors">
              <textarea
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
                placeholder="Commit message..."
                rows={2}
                disabled={!repositoryPath || isLoading}
                className="w-full resize-none rounded-md border-none bg-transparent px-1 py-1 text-[12px] text-white/80 transition-all duration-150 placeholder:text-white/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="ml-auto flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void onPull()}
                    disabled={!canPull || isLoading}
                    className="size-6 text-white/20 hover:text-white/60"
                    title={viewModel.pullActionLabel ?? "Pull"}
                  >
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void onPush()}
                    disabled={!canPush || isLoading}
                    className="size-6 text-white/20 hover:text-white/60"
                    title={viewModel.pushActionLabel ?? "Push"}
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="px-1">
              <GitPanelStatus
                tone={viewModel.statusTone}
                message={viewModel.statusMessage}
              />
            </div>
          </section>

          <div className="space-y-5">
            <ChangeList
              title="Staged"
              emptyLabel="No staged changes"
              changes={repositoryStatus?.stagedChanges ?? []}
              actionLabel="Unstage"
              actionIcon={<ArrowDown className="size-3" />}
              onAction={(filePath) => void onUnstageFile(filePath)}
            />

            <ChangeList
              title="Changes"
              emptyLabel="No unstaged changes"
              changes={repositoryStatus?.unstagedChanges ?? []}
              actionLabel="Stage"
              actionIcon={<ArrowUp className="size-3" />}
              onAction={(filePath) => void onStageFile(filePath)}
              onDiscard={(filePath) => void onDiscardFile(filePath)}
            />
          </div>

          <div className="space-y-1 border-t border-white/[0.04] pt-4 px-1">
            {[
              { label: "Project", value: projectName ?? worktree?.label },
              { label: "Commit", value: viewModel.commitLabel },
              { label: "Upstream", value: viewModel.upstreamLabel },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <span className="shrink-0 text-white/20">{row.label}</span>
                <span className="min-w-0 truncate text-right text-white/45">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
