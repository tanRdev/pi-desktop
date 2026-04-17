import type { GitDiffHunk, GitFileDiff } from "@pi-desktop/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "../ui/icons";

interface GitDiffViewerProps {
  diff: GitFileDiff;
  onClose: () => void;
}

function DiffLine({
  line,
}: {
  line: {
    type: string;
    content: string;
    oldLineNumber: number | null;
    newLineNumber: number | null;
  };
}) {
  const bgClass =
    line.type === "add"
      ? "bg-[var(--color-accent)]/[0.08]"
      : line.type === "remove"
        ? "bg-rose-500/[0.08]"
        : "";
  const textClass =
    line.type === "add"
      ? "text-[var(--color-accent)]"
      : line.type === "remove"
        ? "text-rose-400"
        : "text-white/50";

  return (
    <div className={cn("flex font-mono text-[10px] leading-[18px]", bgClass)}>
      <span className="w-9 shrink-0 select-none text-right text-white/20 pr-2 border-r border-white/[0.06]">
        {line.oldLineNumber ?? ""}
      </span>
      <span className="w-9 shrink-0 select-none text-right text-white/20 pr-2 border-r border-white/[0.06]">
        {line.newLineNumber ?? ""}
      </span>
      <span className={cn("w-4 shrink-0 select-none text-center", textClass)}>
        {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
      </span>
      <span className={cn("truncate", textClass)}>{line.content}</span>
    </div>
  );
}

function HunkHeader({ hunk }: { hunk: GitDiffHunk }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-[var(--color-accent)]/[0.06] text-[10px] text-white/40 font-mono select-none border-y border-white/[0.06]">
      <span>
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
      </span>
    </div>
  );
}

export function GitDiffViewer({ diff, onClose }: GitDiffViewerProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg-primary)]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 shrink-0">
        <div
          className={cn(
            "text-[10px] font-bold font-mono px-1.5 py-0.5",
            diff.status === "added" || diff.status === "untracked"
              ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
              : diff.status === "deleted"
                ? "text-rose-400 bg-rose-500/10"
                : diff.status === "modified" || diff.status === "renamed"
                  ? "text-amber-400 bg-amber-500/10"
                  : "text-white/40 bg-white/5",
          )}
        >
          {diff.status === "added" || diff.status === "untracked"
            ? "+"
            : diff.status === "deleted"
              ? "-"
              : diff.status === "modified"
                ? "M"
                : diff.status === "renamed"
                  ? "R"
                  : "·"}
        </div>
        <span className="truncate text-[10.5px] text-white/70 flex-1 min-w-0 font-mono">
          {diff.filePath}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-5 shrink-0 items-center justify-center text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/70"
        >
          <X className="size-3" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        {diff.binary ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-white/30">
            Binary file
          </div>
        ) : diff.hunks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-white/30">
            No changes
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {diff.hunks.map((hunk, i) => (
              <div key={i}>
                <HunkHeader hunk={hunk} />
                <div>
                  {hunk.lines.map((line, j) => (
                    <DiffLine key={j} line={line} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
