import type { GitDiffHunk, GitDiffLine, GitFileDiff } from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { Check, Copy, X } from "@/components/ui/phosphor-icons";
import { computeCharDiff } from "./compute-char-diff";

interface GitDiffViewerProps {
  diff: GitFileDiff;
  onClose: () => void;
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

function IntraLineSpan({
  text,
  highlightStart,
  highlight,
  highlightClass,
  defaultClass,
}: {
  text: string;
  highlightStart: number;
  highlight: string;
  highlightClass: string;
  defaultClass: string;
}) {
  if (!highlight) return <span className={defaultClass}>{text}</span>;
  return (
    <>
      {highlightStart > 0 && (
        <span className={defaultClass}>{text.slice(0, highlightStart)}</span>
      )}
      <span className={highlightClass}>{highlight}</span>
      {highlightStart + highlight.length < text.length && (
        <span className={defaultClass}>
          {text.slice(highlightStart + highlight.length)}
        </span>
      )}
    </>
  );
}

function DiffLine({
  line,
  pairedLine,
}: {
  line: GitDiffLine;
  pairedLine: GitDiffLine | null;
}) {
  if (line.type === "hunk_header") {
    return (
      <div className="flex font-mono text-[11px] leading-[18px] text-blue-400 select-none">
        <span className="w-9 shrink-0 select-none text-right text-white/50 pr-2 border-r border-white/[0.06]" />
        <span className="w-9 shrink-0 select-none text-right text-white/50 pr-2 border-r border-white/[0.06]" />
        <span className="w-4 shrink-0 select-none text-center" />
        <span className="truncate pl-1 text-blue-400">{line.content}</span>
      </div>
    );
  }

  const isAdd = line.type === "add";
  const isRemove = line.type === "remove";
  const bgClass = isAdd ? "bg-emerald-500/10" : isRemove ? "bg-red-500/10" : "";
  const textClass = isAdd
    ? "text-emerald-400"
    : isRemove
      ? "text-red-400"
      : "text-white/50";
  const prefix = isAdd ? "+" : isRemove ? "-" : " ";
  const lineNumber = isRemove
    ? line.oldLineNumber
    : isAdd
      ? line.newLineNumber
      : line.newLineNumber;
  const emptyLineNum = isRemove ? "" : isAdd ? "" : line.oldLineNumber;

  const charDiff =
    pairedLine && (isAdd || isRemove)
      ? computeCharDiff(
          isRemove ? line.content : pairedLine.content,
          isAdd ? line.content : pairedLine.content,
        )
      : null;
  const middle = isRemove ? charDiff?.oldMiddle : charDiff?.newMiddle;
  const middleStart = charDiff ? charDiff.prefix.length : 0;

  return (
    <div className={cn("flex font-mono text-[11px] leading-[18px]", bgClass)}>
      <span className="w-9 shrink-0 select-none text-right text-white/50 pr-2 border-r border-white/[0.06]">
        {isRemove ? lineNumber : emptyLineNum}
      </span>
      <span className="w-9 shrink-0 select-none text-right text-white/50 pr-2 border-r border-white/[0.06]">
        {isAdd ? lineNumber : emptyLineNum}
      </span>
      <span className={cn("w-4 shrink-0 select-none text-center", textClass)}>
        {prefix}
      </span>
      <span className="truncate pl-1">
        {charDiff && middle ? (
          <IntraLineSpan
            text={line.content}
            highlightStart={middleStart}
            highlight={middle}
            highlightClass={isRemove ? "bg-red-500/25" : "bg-emerald-500/25"}
            defaultClass={textClass}
          />
        ) : (
          <span className={textClass}>{line.content}</span>
        )}
      </span>
    </div>
  );
}

export function pairRemoveAddLines(
  lines: GitDiffLine[],
): Map<number, GitDiffLine | null> {
  const paired = new Map<number, GitDiffLine | null>();
  let lastRemoveIndex: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.type === "remove") {
      lastRemoveIndex = i;
    } else if (line.type === "add" && lastRemoveIndex !== null) {
      const removeLine = lines[lastRemoveIndex];
      if (removeLine) {
        paired.set(lastRemoveIndex, line);
        paired.set(i, removeLine);
      }
      lastRemoveIndex = null;
    } else if (line.type === "context" || line.type === "hunk_header") {
      lastRemoveIndex = null;
    }
  }

  return paired;
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

/**
 * Re-serialize a diff to a unified-ish text form suitable for clipboard copy.
 * Not a strict git-format emitter; preserves +/- prefix and context space.
 */
export function serializeDiffForClipboard(diff: GitFileDiff): string {
  const header = `--- a/${diff.oldFilePath ?? diff.filePath}\n+++ b/${diff.filePath}`;
  const body = diff.hunks
    .map((hunk) => {
      const hunkHeader = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
      const lines = hunk.lines
        .map((line) => {
          const prefix =
            line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
          return `${prefix}${line.content}`;
        })
        .join("\n");
      return `${hunkHeader}\n${lines}`;
    })
    .join("\n");
  return `${header}\n${body}`;
}

export function GitDiffViewer({ diff, onClose }: GitDiffViewerProps) {
  const language = React.useMemo(
    () => detectLanguageHint(diff.filePath),
    [diff.filePath],
  );
  const [copied, setCopied] = React.useState(false);

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
          className="shrink-0 font-mono text-[9.5px] uppercase tracking-wide text-white/50"
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
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
