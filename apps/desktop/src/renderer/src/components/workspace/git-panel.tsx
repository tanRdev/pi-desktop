import type { GitRepositoryStatus, WorktreeSnapshot } from "@pidesk/shared";
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
      <WarningCircle className="size-4 text-yellow-400/70" />
    ) : tone === "neutral" ? (
      <CheckCircle className="size-4 text-emerald-400/70" />
    ) : (
      <CircleDashed className="size-4 text-white/30" />
    );

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-3 text-[12px] leading-5",
        tone === "warning"
          ? "border-yellow-400/10 bg-yellow-400/[0.05] text-yellow-100/80"
          : tone === "neutral"
            ? "border-white/[0.05] bg-white/[0.03] text-white/70"
            : "border-white/[0.04] bg-white/[0.02] text-white/45",
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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">
          {title}
        </h3>
        <span className="text-[11px] text-white/25">{changes.length}</span>
      </div>
      <div className="overflow-hidden rounded-md border border-white/[0.04] bg-white/[0.02]">
        {changes.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-white/35">
            {emptyLabel}
          </div>
        ) : (
          changes.map((change, index) => (
            <div
              key={`${title}-${change.path}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5",
                index > 0 && "border-t border-white/[0.04]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-white/80">
                  {change.path}
                </div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-white/30">
                  {change.status.replaceAll("_", " ")}
                </div>
              </div>
              {onDiscard ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDiscard(change.path)}
                  aria-label={`Discard ${change.path}`}
                >
                  <Trash className="size-3" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onAction(change.path)}
              >
                {actionIcon}
                {actionLabel}
              </Button>
            </div>
          ))
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
    () => buildGitPanelViewModel({ worktree, repositoryStatus }),
    [repositoryStatus, worktree],
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-[#0a0a0a] text-white",
        className,
      )}
    >
      <div className="border-b border-white/[0.04] px-5 py-4 select-none">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              {viewModel.title}
            </p>
            <h2 className="truncate text-base font-medium text-white/80">
              {viewModel.branchLabel}
            </h2>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-white/30">
              {projectName ?? worktree?.label ?? "No project"}
            </p>
          </div>
          {worktree ? (
            <GitStatusChip git={worktree.git} className="mt-1" />
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3 rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-3">
              <div className="min-w-0 space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/30">
                  Active summary
                </div>
                <div className="text-sm text-white/80">{viewModel.summary}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/30">
                  {viewModel.commitLabel} · {viewModel.syncLabel}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void onRefresh()}
                disabled={!repositoryPath || isRefreshing}
              >
                {isRefreshing ? (
                  <CircleDashed className="size-3.5 animate-spin" />
                ) : null}
                Refresh
              </Button>
            </div>
            <GitPanelStatus
              tone={viewModel.statusTone}
              message={viewModel.statusMessage}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">
              Commit
            </h3>
            <div className="space-y-3 rounded-md border border-white/[0.04] bg-white/[0.02] p-3">
              <textarea
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
                placeholder="Write a concise commit message"
                rows={3}
                disabled={!repositoryPath || isLoading}
                className="w-full rounded-md border border-white/[0.06] bg-[#141414] px-3 py-2 text-sm text-white/80 transition-all duration-150 placeholder:text-white/30 focus-visible:border-white/[0.12] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => void onCommit()}
                  disabled={
                    !repositoryPath || !commitMessage.trim() || isLoading
                  }
                >
                  <FloppyDisk className="size-3.5" />
                  {viewModel.commitActionLabel ?? "Commit"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void onPull()}
                  disabled={!repositoryPath || isLoading}
                >
                  <ArrowDown className="size-3.5" />
                  {viewModel.pullActionLabel ?? "Pull"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void onPush()}
                  disabled={!repositoryPath || isLoading}
                >
                  <ArrowUp className="size-3.5" />
                  {viewModel.pushActionLabel ?? "Push"}
                </Button>
              </div>
            </div>
          </section>

          <ChangeList
            title="Staged"
            emptyLabel="No staged files"
            changes={repositoryStatus?.stagedChanges ?? []}
            actionLabel="Unstage"
            actionIcon={<ArrowDown className="size-3.5" />}
            onAction={(filePath) => void onUnstageFile(filePath)}
          />

          <ChangeList
            title="Working Tree"
            emptyLabel="No unstaged files"
            changes={repositoryStatus?.unstagedChanges ?? []}
            actionLabel="Stage"
            actionIcon={<ArrowUp className="size-3.5" />}
            onAction={(filePath) => void onStageFile(filePath)}
            onDiscard={(filePath) => void onDiscardFile(filePath)}
          />

          {viewModel.sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">
                {section.title}
              </h3>
              <div className="overflow-hidden rounded-md border border-white/[0.04] bg-white/[0.02]">
                {section.rows.map((row, index) => (
                  <div
                    key={`${section.title}-${row.label}`}
                    className={cn(
                      "flex items-start justify-between gap-3 px-3 py-2.5 text-[12px]",
                      index > 0 && "border-t border-white/[0.04]",
                    )}
                  >
                    <span className="shrink-0 text-white/35">{row.label}</span>
                    <span className="min-w-0 text-right text-white/75">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
