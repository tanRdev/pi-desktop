import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { Virtuoso } from "react-virtuoso";
import {
  ArrowCounterClockwise,
  Check,
  Copy,
  Trash,
} from "@/components/ui/phosphor-icons";
import type { FileStageEntry, GitPanelCapabilities } from "./git-panel-model";

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

export interface CombinedChangeListProps {
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
}

export function CombinedChangeList({
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
}: CombinedChangeListProps) {
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
    let nextAdded = 0;
    let nextDeleted = 0;
    let nextModified = 0;

    entries.forEach((entry) => {
      if (entry.status === "added" || entry.status === "untracked") {
        nextAdded += 1;
        return;
      }

      if (entry.status === "deleted") {
        nextDeleted += 1;
        return;
      }

      if (entry.status === "modified" || entry.status === "renamed") {
        nextModified += 1;
      }
    });

    return {
      added: nextAdded,
      deleted: nextDeleted,
      modified: nextModified,
    };
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
          {added > 0 ? (
            <span className="flex items-center justify-center bg-[var(--color-accent)]/10 px-1 py-px text-[var(--color-accent)] text-[11px]">
              +{added}
            </span>
          ) : null}
          {modified > 0 ? (
            <span className="flex items-center justify-center bg-amber-500/10 px-1 py-px text-amber-400 text-[11px]">
              ~{modified}
            </span>
          ) : null}
          {deleted > 0 ? (
            <span className="flex items-center justify-center bg-rose-500/10 px-1 py-px text-rose-400 text-[11px]">
              -{deleted}
            </span>
          ) : null}
          {added === 0 &&
          modified === 0 &&
          deleted === 0 &&
          allPaths.length > 0 ? (
            <span className="flex items-center justify-center bg-white/5 px-1 py-px text-white/40 text-[11px]">
              {allPaths.length}
            </span>
          ) : null}
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
