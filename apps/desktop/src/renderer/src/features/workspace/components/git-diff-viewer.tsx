import type { GitDiffHunk, GitDiffLine, GitFileDiff } from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { Check, Copy, X } from "@/components/ui/phosphor-icons";
import { DiffLine } from "./git-diff-line";
import {
  type DiffLineCoordinate,
  formatDiffSelectionQuestion,
  isDiffLineSelected,
  pairRemoveAddLines,
  serializeDiffForClipboard,
  toggleDiffLineSelection,
} from "./git-diff-selection";

export { pairRemoveAddLines, serializeDiffForClipboard };

interface GitDiffViewerProps {
  diff: GitFileDiff;
  onClose: () => void;
  /**
   * When provided, diff lines become selectable and the user can send
   * a question about the selected lines (with old/new coordinates) to
   * the agent. When omitted, the viewer is read-only.
   */
  onAskAboutSelection?: (question: string) => void;
}

/**
 * Best-effort language detection from a file extension. Not a full syntax
 * highlighter — just a hint surfaced in the header and used to pick a
 * monospace-friendly class name. Intentionally dep-free.
 */
const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  md: "markdown",
  mdx: "mdx",
  css: "css",
  scss: "scss",
  html: "html",
  rs: "rust",
  go: "go",
  py: "python",
  rb: "ruby",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  lock: "text",
};

export function detectLanguageHint(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  const base = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "text";
  const ext = base.slice(dot + 1).toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] ?? ext;
}

function HunkHeader({ hunk }: { hunk: GitDiffHunk }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-[var(--color-accent)]/[0.04] text-[11px] text-blue-400 font-mono select-none border-y border-white/[0.06]">
      <span>
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
      </span>
    </div>
  );
}

export function GitDiffViewer({
  diff,
  onClose,
  onAskAboutSelection,
}: GitDiffViewerProps) {
  const language = React.useMemo(
    () => detectLanguageHint(diff.filePath),
    [diff.filePath],
  );
  const [copied, setCopied] = React.useState(false);
  // Selection is keyed by file so it never leaks across diffs.
  const [selection, setSelection] = React.useState<{
    filePath: string;
    lines: DiffLineCoordinate[];
  }>({ filePath: diff.filePath, lines: [] });
  const selectedLines =
    selection.filePath === diff.filePath ? selection.lines : [];
  const selectable = Boolean(onAskAboutSelection);

  const handleToggleLine = React.useCallback(
    (line: GitDiffLine) => {
      setSelection((current) => {
        const currentLines =
          current.filePath === diff.filePath ? current.lines : [];
        return {
          filePath: diff.filePath,
          lines: toggleDiffLineSelection(currentLines, line),
        };
      });
    },
    [diff.filePath],
  );

  const handleAskAboutSelection = React.useCallback(() => {
    if (!onAskAboutSelection || selectedLines.length === 0) return;
    onAskAboutSelection(formatDiffSelectionQuestion(diff, selectedLines));
    setSelection({ filePath: diff.filePath, lines: [] });
  }, [diff, onAskAboutSelection, selectedLines]);

  const handleCopyDiff = React.useCallback(() => {
    const text = serializeDiffForClipboard(diff);
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (!nav?.clipboard) return;
    nav.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1200);
      })
      .catch(() => {
        setCopied(false);
      });
  }, [diff]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg-primary)]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 shrink-0">
        <div
          className={cn(
            "text-[11px] font-bold font-mono px-1.5 py-0.5",
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
        <span className="truncate text-[11px] text-white/70 flex-1 min-w-0 font-mono">
          {diff.filePath}
        </span>
        <span
          className="shrink-0 font-mono text-[9.5px] tracking-wide text-white/50"
          title={`Language: ${language}`}
        >
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopyDiff}
          disabled={diff.binary || diff.hunks.length === 0}
          aria-label="Copy diff"
          title="Copy diff"
          className="flex size-5 shrink-0 items-center justify-center text-white/50 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? (
            <Check className="size-3 text-[var(--color-accent)]" />
          ) : (
            <Copy className="size-3" />
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close diff"
          className="flex size-5 shrink-0 items-center justify-center text-white/50 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white/70"
        >
          <X className="size-3" />
        </button>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto custom-scrollbar font-mono",
          `lang-${language}`,
        )}
        data-language={language}
      >
        {diff.binary ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-white/50">
            Binary file
          </div>
        ) : diff.hunks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-white/50">
            No changes
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {diff.hunks.map((hunk, i) => {
              const paired = pairRemoveAddLines(hunk.lines);
              return (
                <div key={i}>
                  <HunkHeader hunk={hunk} />
                  <div>
                    {hunk.lines.map((line, j) => (
                      <DiffLine
                        key={j}
                        line={line}
                        pairedLine={paired.get(j) ?? null}
                        selectable={selectable}
                        selected={isDiffLineSelected(selectedLines, line)}
                        onToggleSelect={handleToggleLine}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectable && selectedLines.length > 0 ? (
        <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2 shrink-0">
          <span className="text-[11px] text-white/50">
            {selectedLines.length}{" "}
            {selectedLines.length === 1 ? "line" : "lines"} selected
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setSelection({ filePath: diff.filePath, lines: [] })}
            className="text-[11px] text-white/50 transition-colors hover:text-white/80"
          >
            Clear selection
          </button>
          <button
            type="button"
            onClick={handleAskAboutSelection}
            className="rounded-sm border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.1]"
          >
            Ask about selection
          </button>
        </div>
      ) : null}
    </div>
  );
}
