import * as React from "react";
import { Virtuoso } from "react-virtuoso";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ICON_SIZE_SM, MagnifyingGlass } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  type HighlightRange,
  type SearchableMessage,
  type SearchResult,
  search,
} from "./search-engine";

export interface ThreadSearchDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * The pool of messages to search across. Provided by the host so the
   * dialog stays presentation-only.
   */
  readonly messages: ReadonlyArray<SearchableMessage>;
  /**
   * Called when the user activates a result. The host is responsible for
   * dispatching the navigation event (e.g. `pi:open-message`).
   */
  readonly onSelect: (result: SearchResult) => void;
  /** Optional placeholder for the search input. */
  readonly placeholder?: string;
  /**
   * Threshold above which the result list is virtualized.
   * Below this, a plain list is rendered. Defaults to 25.
   */
  readonly virtualizeThreshold?: number;
}

/**
 * Renders a snippet with `<mark>`-style highlighted ranges.
 */
export function HighlightedSnippet({
  snippet,
  highlights,
}: {
  snippet: string;
  highlights: ReadonlyArray<HighlightRange>;
}) {
  if (highlights.length === 0) {
    return <>{snippet}</>;
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  highlights.forEach((h, idx) => {
    if (h.start > cursor) {
      parts.push(snippet.slice(cursor, h.start));
    }
    parts.push(
      <mark
        key={`hl-${idx}-${h.start}`}
        className="bg-[var(--color-accent-ring)]/30 text-white rounded-none px-0.5"
      >
        {snippet.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  });
  if (cursor < snippet.length) {
    parts.push(snippet.slice(cursor));
  }
  return <>{parts}</>;
}

interface ResultRowProps {
  result: SearchResult;
  selected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

const ResultRow = React.forwardRef<HTMLButtonElement, ResultRowProps>(
  function ResultRow({ result, selected, onMouseEnter, onClick }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        data-testid={`thread-search-row-${result.messageId}`}
        data-selected={selected ? "true" : "false"}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
        className={cn(
          "flex w-full flex-col gap-1 px-4 py-2 text-left",
          "border-l-2 border-transparent",
          "transition-colors duration-[var(--duration-fast)]",
          selected && "bg-white/[0.04] border-[var(--color-accent-ring)]",
          !selected && "hover:bg-white/[0.02]",
        )}
      >
        <div className="flex items-center justify-between gap-2 text-[10px] text-white/40">
          <span className="truncate font-mono uppercase tracking-[0.08em]">
            {result.threadTitle}
          </span>
          <span className="shrink-0 text-white/30">{result.role}</span>
        </div>
        <div className="text-[11px] leading-5 text-white/80">
          <HighlightedSnippet
            snippet={result.snippet}
            highlights={result.highlights}
          />
        </div>
      </button>
    );
  },
);

export function ThreadSearchDialog({
  open,
  onOpenChange,
  messages,
  onSelect,
  placeholder = "Search messages across threads…",
  virtualizeThreshold = 25,
}: ThreadSearchDialogProps) {
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const results = React.useMemo(
    () => (query.trim() ? search(query, messages) : []),
    [query, messages],
  );

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  React.useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(results.length === 0 ? 0 : results.length - 1);
    }
  }, [results.length, selectedIndex]);

  const runSelected = React.useCallback(
    (result: SearchResult | undefined) => {
      if (!result) return;
      onSelect(result);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) =>
        results.length === 0 ? 0 : (i + 1) % results.length,
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) =>
        results.length === 0 ? 0 : (i - 1 + results.length) % results.length,
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runSelected(results[selectedIndex]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  const useVirtualized = results.length > virtualizeThreshold;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="thread-search-dialog"
        className="sm:max-w-[640px] p-0 gap-0 top-[18%]"
        onKeyDownCapture={onKeyDown}
      >
        <DialogTitle className="sr-only">Thread Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search messages across all recent threads in the current worktree.
        </DialogDescription>

        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3",
            "border-b border-white/[0.06]",
            "bg-[var(--color-bg-secondary)]",
          )}
        >
          <MagnifyingGlass className={cn(ICON_SIZE_SM, "text-white/30")} />
          <input
            ref={inputRef}
            data-testid="thread-search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent text-[11px] text-white/90 outline-none placeholder:text-white/30",
              "border-none focus:outline-none focus:ring-0",
            )}
          />
          <kbd
            className={cn(
              "hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5",
              "border border-white/[0.06] bg-white/[0.02]",
              "text-[10px] text-white/40",
            )}
          >
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          data-testid="thread-search-list"
          className="max-h-[min(60vh,520px)] overflow-y-auto py-1"
        >
          {query.trim() === "" ? (
            <div
              data-testid="thread-search-hint"
              className="px-4 py-8 text-center text-[11px] text-white/30"
            >
              Type to search across recent threads
            </div>
          ) : results.length === 0 ? (
            <div
              data-testid="thread-search-empty"
              className="px-4 py-8 text-center text-[11px] text-white/30"
            >
              No messages match “{query.trim()}”
            </div>
          ) : useVirtualized ? (
            <Virtuoso
              data={results}
              style={{ height: "min(60vh, 520px)" }}
              computeItemKey={(_, item) => item.messageId}
              itemContent={(index, result) => (
                <ResultRow
                  result={result}
                  selected={index === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => runSelected(result)}
                />
              )}
            />
          ) : (
            results.map((result, index) => (
              <ResultRow
                key={result.messageId}
                result={result}
                selected={index === selectedIndex}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => runSelected(result)}
              />
            ))
          )}
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2 px-4 py-2",
            "border-t border-white/[0.06]",
            "bg-[var(--color-bg-secondary)]",
            "text-[10px] text-white/30",
          )}
        >
          <div className="flex items-center gap-3">
            <span>↵ open</span>
            <span>↑ ↓ navigate</span>
            <span>esc close</span>
          </div>
          <div data-testid="thread-search-count">
            {results.length === 0
              ? ""
              : `${results.length} result${results.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
