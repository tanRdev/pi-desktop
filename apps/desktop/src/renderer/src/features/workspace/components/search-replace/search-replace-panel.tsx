import { ArrowClockwise, BracketsCurly } from "@phosphor-icons/react";
import { cn } from "@pi-desktop/ui";
import * as React from "react";
import {
  ICON_SIZE_SM,
  MagnifyingGlass,
  TextAa,
  X,
} from "@/components/ui/phosphor-icons";
import { type FileIcon, getFileIconByExtension } from "@/lib/file-icons";
import {
  type FileMatch,
  type HighlightRange,
  type SearchOptions,
  type SearchResult,
  searchFiles,
} from "./search-engine";

export interface SearchReplacePanelProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly files: ReadonlyArray<{ filePath: string; content: string }>;
  readonly onReplace?: (filePath: string, content: string) => void;
}

function HighlightedLine({
  lineText,
  highlights,
}: {
  lineText: string;
  highlights: ReadonlyArray<HighlightRange>;
}) {
  if (highlights.length === 0) {
    return <>{lineText}</>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  highlights.forEach((h, idx) => {
    if (h.start > cursor) {
      parts.push(lineText.slice(cursor, h.start));
    }
    parts.push(
      <mark
        key={`hl-${idx}-${h.start}`}
        className="bg-[var(--color-accent)]/30 text-white rounded-none px-0.5"
      >
        {lineText.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  });

  if (cursor < lineText.length) {
    parts.push(lineText.slice(cursor));
  }

  return <>{parts}</>;
}

function FileTypeBadge({ filePath }: { filePath: string }) {
  const ext = filePath.split(".").pop() ?? "";
  if (!ext) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-none px-1 py-0 text-[11px] text-white/40 bg-white/[0.06] shrink-0">
      {ext.toUpperCase()}
    </span>
  );
}

function MatchRow({
  match,
  fileIcon,
  filePath,
  onReplaceOne,
  replaceText,
}: {
  match: FileMatch;
  fileIcon: FileIcon;
  filePath: string;
  onReplaceOne?: (filePath: string, lineNumber: number) => void;
  replaceText: string;
}) {
  const Icon = fileIcon.Icon;
  return (
    <div
      data-testid={`search-match-${filePath}-${match.lineNumber}`}
      className={cn(
        "flex items-start gap-2 px-3 py-1 text-left",
        "hover:bg-white/[0.02]",
        "transition-colors duration-[var(--duration-fast)]",
      )}
    >
      <Icon
        className={cn(fileIcon.colorClassName, "size-3.5 mt-0.5 shrink-0")}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/50 font-mono shrink-0">
            {match.lineNumber}
          </span>
          <span className="text-[11px] leading-5 text-white/80 truncate font-mono">
            <HighlightedLine
              lineText={match.lineText}
              highlights={match.highlights}
            />
          </span>
        </div>
      </div>
      {onReplaceOne && replaceText !== undefined && (
        <button
          type="button"
          data-testid={`replace-one-${filePath}-${match.lineNumber}`}
          onClick={() => onReplaceOne(filePath, match.lineNumber)}
          className={cn(
            "shrink-0 mt-0.5 p-0.5 rounded-none",
            "text-white/50 hover:text-white/70",
            "transition-colors duration-[var(--duration-fast)]",
          )}
          title="Replace this match"
        >
          <ArrowClockwise className="size-3" weight="bold" />
        </button>
      )}
    </div>
  );
}

function FileResultsGroup({
  result,
  onReplaceOne,
  replaceText,
}: {
  result: SearchResult;
  onReplaceOne?: (filePath: string, lineNumber: number) => void;
  replaceText: string;
}) {
  const ext = result.filePath.split(".").pop() ?? null;
  const fileIcon = getFileIconByExtension(
    result.filePath.split("/").pop() ?? result.filePath,
    ext,
  );
  const fileName = result.filePath.split("/").pop() ?? result.filePath;

  return (
    <div data-testid={`search-file-group-${result.filePath}`} className="py-1">
      <div className="flex items-center gap-2 px-3 py-1">
        <fileIcon.Icon className={cn(fileIcon.colorClassName, ICON_SIZE_SM)} />
        <span
          className="text-[11px] text-white/60 truncate"
          title={result.filePath}
        >
          {fileName}
        </span>
        <FileTypeBadge filePath={result.filePath} />
        <span className="text-[11px] text-white/50 shrink-0 ml-auto">
          {result.matches.length}
        </span>
      </div>
      {result.matches.map((match) => (
        <MatchRow
          key={`${result.filePath}:${match.lineNumber}`}
          match={match}
          fileIcon={fileIcon}
          filePath={result.filePath}
          onReplaceOne={onReplaceOne}
          replaceText={replaceText}
        />
      ))}
    </div>
  );
}

export function SearchReplacePanel({
  open,
  onOpenChange,
  files,
  onReplace,
}: SearchReplacePanelProps) {
  const [searchPattern, setSearchPattern] = React.useState("");
  const [replaceText, setReplaceText] = React.useState("");
  const [isRegex, setIsRegex] = React.useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = React.useState(false);
  const [fileFilter, setFileFilter] = React.useState("");
  const [showReplace, setShowReplace] = React.useState(false);
  const [showFileFilter, setShowFileFilter] = React.useState(false);
  const [_isSearching, setIsSearching] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const options: SearchOptions = React.useMemo(
    () => ({
      isRegex,
      isCaseSensitive,
      fileFilter,
    }),
    [isRegex, isCaseSensitive, fileFilter],
  );

  const results = React.useMemo(
    () => searchFiles(files, searchPattern, options),
    [files, searchPattern, options],
  );

  const totalMatches = React.useMemo(
    () => results.reduce((sum, r) => sum + r.matches.length, 0),
    [results],
  );

  React.useEffect(() => {
    if (open) {
      setSearchPattern("");
      setReplaceText("");
      setIsRegex(false);
      setIsCaseSensitive(false);
      setFileFilter("");
      setShowReplace(false);
      setShowFileFilter(false);
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  const handleReplaceOne = React.useCallback(
    (filePath: string, lineNumber: number) => {
      if (!onReplace) return;
      const file = files.find((f) => f.filePath === filePath);
      if (!file) return;

      const lines = file.content.split("\n");
      const lineIdx = lineNumber - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) return;

      const regex = new RegExp(
        isRegex
          ? searchPattern
          : searchPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        isCaseSensitive ? "g" : "gi",
      );
      const original = lines[lineIdx];
      if (!original) return;
      const replaced = original.replace(regex, replaceText);
      if (replaced !== original) {
        lines[lineIdx] = replaced;
        onReplace(filePath, lines.join("\n"));
      }
    },
    [onReplace, files, searchPattern, replaceText, isRegex, isCaseSensitive],
  );

  const handleReplaceAll = React.useCallback(() => {
    if (!onReplace || !searchPattern.trim()) return;

    for (const result of results) {
      const file = files.find((f) => f.filePath === result.filePath);
      if (!file) continue;

      const regex = new RegExp(
        isRegex
          ? searchPattern
          : searchPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        isCaseSensitive ? "g" : "gi",
      );
      const newContent = file.content.replace(regex, replaceText);
      if (newContent !== file.content) {
        onReplace(result.filePath, newContent);
      }
    }
  }, [
    onReplace,
    files,
    results,
    searchPattern,
    replaceText,
    isRegex,
    isCaseSensitive,
  ]);

  const handleSearchKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        setIsSearching(true);
        window.setTimeout(() => setIsSearching(false), 100);
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        handleReplaceAll();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    },
    [onOpenChange, handleReplaceAll],
  );

  if (!open) return null;

  return (
    <div
      data-testid="search-replace-panel"
      data-slot="search-replace-panel"
      className={cn(
        "w-full border-b border-white/[0.06]",
        "bg-[var(--color-bg-secondary)]",
        "motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:duration-200",
      )}
    >
      <div className="flex flex-col gap-0 px-3 py-2">
        {/* Search row */}
        <div className="flex items-center gap-1.5">
          <MagnifyingGlass
            className={cn(ICON_SIZE_SM, "text-white/50 shrink-0")}
          />
          <input
            ref={searchInputRef}
            data-testid="search-input"
            value={searchPattern}
            onChange={(e) => setSearchPattern(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search"
            className={cn(
              "flex-1 bg-transparent text-[11px] text-white/90 outline-none",
              "placeholder:text-white/50 border-none focus:outline-none focus:ring-0",
            )}
          />
          <button
            type="button"
            data-testid="toggle-regex"
            onClick={() => setIsRegex((prev) => !prev)}
            title="Use regular expression"
            className={cn(
              "p-1 rounded-none transition-colors duration-[var(--duration-fast)]",
              isRegex
                ? "text-[var(--color-accent)] bg-white/[0.06]"
                : "text-white/50 hover:text-white/60",
            )}
          >
            <BracketsCurly
              className={ICON_SIZE_SM}
              weight={isRegex ? "fill" : "regular"}
            />
          </button>
          <button
            type="button"
            data-testid="toggle-case-sensitive"
            onClick={() => setIsCaseSensitive((prev) => !prev)}
            title="Match case"
            className={cn(
              "p-1 rounded-none transition-colors duration-[var(--duration-fast)]",
              isCaseSensitive
                ? "text-[var(--color-accent)] bg-white/[0.06]"
                : "text-white/50 hover:text-white/60",
            )}
          >
            <TextAa
              className={ICON_SIZE_SM}
              weight={isCaseSensitive ? "fill" : "regular"}
            />
          </button>
          <button
            type="button"
            data-testid="toggle-replace"
            onClick={() => setShowReplace((prev) => !prev)}
            title="Toggle replace"
            className={cn(
              "p-1 rounded-none transition-colors duration-[var(--duration-fast)]",
              showReplace
                ? "text-[var(--color-accent)] bg-white/[0.06]"
                : "text-white/50 hover:text-white/60",
            )}
          >
            <ArrowClockwise
              className={ICON_SIZE_SM}
              weight={showReplace ? "fill" : "regular"}
            />
          </button>
          <button
            type="button"
            data-testid="toggle-file-filter"
            onClick={() => setShowFileFilter((prev) => !prev)}
            title="Filter files"
            className={cn(
              "p-1 rounded-none transition-colors duration-[var(--duration-fast)]",
              showFileFilter
                ? "text-[var(--color-accent)] bg-white/[0.06]"
                : "text-white/50 hover:text-white/60",
            )}
          >
            <span className="text-[11px] font-mono leading-none select-none">
              *
            </span>
          </button>
          <button
            type="button"
            data-testid="close-search-panel"
            onClick={() => onOpenChange(false)}
            title="Close"
            className={cn(
              "p-1 rounded-none text-white/50 hover:text-white/60",
              "transition-colors duration-[var(--duration-fast)]",
            )}
          >
            <X className={ICON_SIZE_SM} />
          </button>
        </div>

        {/* Replace row */}
        {showReplace && (
          <div className="flex items-center gap-1.5 mt-1">
            <ArrowClockwise
              className={cn(ICON_SIZE_SM, "text-white/50 shrink-0")}
            />
            <input
              data-testid="replace-input"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Replace"
              className={cn(
                "flex-1 bg-transparent text-[11px] text-white/90 outline-none",
                "placeholder:text-white/50 border-none focus:outline-none focus:ring-0",
              )}
            />
            {searchPattern.trim() && (
              <button
                type="button"
                data-testid="replace-all-button"
                onClick={handleReplaceAll}
                disabled={totalMatches === 0}
                title={`Replace all (${totalMatches} match${totalMatches === 1 ? "" : "es"})`}
                className={cn(
                  "px-2 py-0.5 text-[11px] rounded-none",
                  "border border-white/[0.08] bg-white/[0.02]",
                  "text-white/60 hover:text-white/90",
                  "transition-colors duration-[var(--duration-fast)]",
                  "disabled:opacity-30 disabled:pointer-events-none",
                )}
              >
                Replace All
              </button>
            )}
          </div>
        )}

        {/* File filter row */}
        {showFileFilter && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-white/50 font-mono shrink-0">
              *
            </span>
            <input
              data-testid="file-filter-input"
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onOpenChange(false);
                }
              }}
              placeholder="e.g. *.ts, src/**"
              className={cn(
                "flex-1 bg-transparent text-[11px] text-white/90 outline-none",
                "placeholder:text-white/50 border-none focus:outline-none focus:ring-0",
                "font-mono",
              )}
            />
          </div>
        )}
      </div>

      {/* Results */}
      {searchPattern.trim() && (
        <div
          data-testid="search-results"
          className={cn(
            "max-h-[min(40vh,400px)] overflow-y-auto",
            "border-t border-white/[0.06]",
          )}
        >
          {results.length === 0 ? (
            <div
              data-testid="search-no-results"
              className="px-3 py-6 text-center text-[11px] text-white/50"
            >
              No results found
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-white/50 border-b border-white/[0.04]">
                <span>
                  {totalMatches} match{totalMatches === 1 ? "" : "es"} in{" "}
                  {results.length} file{results.length === 1 ? "" : "s"}
                </span>
                <span>
                  <kbd className="px-1 border border-white/[0.06] bg-white/[0.02]">
                    Enter
                  </kbd>{" "}
                  search{" "}
                  <kbd className="px-1 border border-white/[0.06] bg-white/[0.02]">
                    ⇧Enter
                  </kbd>{" "}
                  replace all
                </span>
              </div>
              {results.map((result) => (
                <FileResultsGroup
                  key={result.filePath}
                  result={result}
                  onReplaceOne={showReplace ? handleReplaceOne : undefined}
                  replaceText={replaceText}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
