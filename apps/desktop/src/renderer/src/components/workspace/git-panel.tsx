import type { WorktreeSnapshot } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  ArrowUpRight,
  CheckCircle,
  CircleDashed,
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
  worktree: WorktreeSnapshot | null;
  onOpenGit?: () => void;
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

export function GitPanel({
  className,
  projectName,
  worktree,
  onOpenGit,
}: GitPanelProps) {
  const viewModel = React.useMemo(
    () => buildGitPanelViewModel({ worktree }),
    [worktree],
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
              {viewModel.primaryActionLabel && onOpenGit ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onOpenGit}
                  className="shrink-0"
                >
                  <ArrowUpRight className="size-3.5" />
                  {viewModel.primaryActionLabel}
                </Button>
              ) : null}
            </div>
            <GitPanelStatus
              tone={viewModel.statusTone}
              message={viewModel.statusMessage}
            />
          </section>

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
