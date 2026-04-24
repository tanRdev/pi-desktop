import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command as CommandGlyph,
  ICON_SIZE_SM,
  MagnifyingGlass,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { Command, CommandSearchHit } from "./command-registry";
import { commandRegistry, useCommands } from "./command-registry";

export type CommandPaletteProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly placeholder?: string;
  readonly searchFn?: (query: string) => ReadonlyArray<CommandSearchHit>;
  readonly recentIdsFn?: (limit: number) => string[];
  readonly frequentIdsFn?: (limit: number) => string[];
};

const LIST_ITEM_ID = (id: string) => `pi-cmd-item-${id}`;

export function CommandPalette({
  open,
  onOpenChange,
  placeholder = "Type a command or search…",
  searchFn,
  recentIdsFn,
  frequentIdsFn,
}: CommandPaletteProps) {
  // Subscribe to registry so the list stays live while the palette is open.
  const liveCommands = useCommands();

  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const hits = React.useMemo(() => {
    void liveCommands;
    const q = query.trim();
    if (q.length > 0) {
      const fn = searchFn ?? ((qs: string) => commandRegistry.search(qs));
      return fn(query);
    }
    const getRecent =
      recentIdsFn ??
      ((limit: number) => commandRegistry.getRecentCommandIds(limit));
    const getFrequent =
      frequentIdsFn ??
      ((limit: number) => commandRegistry.getFrequentCommandIds(limit));
    const recentIds = getRecent(5);
    const frequentIds = getFrequent(5);
    if (recentIds.length === 0 && frequentIds.length === 0) {
      const fn = searchFn ?? ((qs: string) => commandRegistry.search(qs));
      return fn("");
    }
    return buildHistoryHits(recentIds, frequentIds, commandRegistry);
  }, [query, searchFn, liveCommands, recentIdsFn, frequentIdsFn]);

  // Reset state whenever the palette opens.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Focus input on next tick to ensure portal is mounted.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  // Clamp selected index if results shrink.
  React.useEffect(() => {
    if (selectedIndex >= hits.length) {
      setSelectedIndex(hits.length === 0 ? 0 : hits.length - 1);
    }
  }, [hits.length, selectedIndex]);

  // Ensure selected item stays in view.
  React.useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const selected = hits[selectedIndex];
    if (!selected) return;
    const el = container.querySelector<HTMLElement>(
      `[data-cmd-id="${selected.command.id}"]`,
    );
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, hits]);

  const runSelected = React.useCallback(
    (hit: CommandSearchHit | undefined, modifier: boolean) => {
      if (!hit) return;
      let shouldClose = true;
      const ctx = {
        modifier,
        close: () => {
          shouldClose = true;
        },
        keepOpen: () => {
          shouldClose = false;
        },
      };
      try {
        void commandRegistry.run(hit.command.id, ctx);
      } finally {
        if (shouldClose) {
          onOpenChange(false);
        }
      }
    },
    [onOpenChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (hits.length === 0 ? 0 : (i + 1) % hits.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) =>
        hits.length === 0 ? 0 : (i - 1 + hits.length) % hits.length,
      );
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setSelectedIndex(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setSelectedIndex(Math.max(0, hits.length - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runSelected(hits[selectedIndex], e.metaKey || e.ctrlKey);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  const grouped = React.useMemo(() => groupHits(hits), [hits]);
  const selectedId =
    hits[selectedIndex]?.command.id ?? hits[0]?.command.id ?? undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="command-palette"
        className="sm:max-w-[560px] p-0 gap-0 top-[20%]"
        onKeyDownCapture={onKeyDown}
      >
        {/* a11y title/description (visually hidden via sr-only). */}
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Run a command or search.
        </DialogDescription>

        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3",
            "border-b border-white/[0.06]",
            "bg-[var(--color-bg-secondary)]",
          )}
        >
          <MagnifyingGlass className={cn(ICON_SIZE_SM, "text-white/50")} />
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            role="combobox"
            aria-expanded={open}
            aria-controls="command-palette-listbox"
            aria-activedescendant={
              selectedId ? LIST_ITEM_ID(selectedId) : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent text-[11px] text-white/90 outline-none placeholder:text-white/50",
              "border-none focus:outline-none focus:ring-0",
            )}
          />
          <kbd
            className={cn(
              "hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5",
              "border border-white/[0.06] bg-white/[0.02]",
              "text-[11px] text-white/40",
            )}
          >
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="command-palette-listbox"
          role="listbox"
          aria-label="Commands"
          data-testid="command-palette-list"
          className="max-h-[min(60vh,480px)] overflow-y-auto py-1"
        >
          {hits.length === 0 ? (
            <div
              data-testid="command-palette-empty"
              className="px-4 py-8 text-center text-[11px] text-white/50"
            >
              No commands found
            </div>
          ) : (
            grouped.map((section) => (
              <div key={section.group ?? "__ungrouped"}>
                {section.group ? (
                  <div
                    className={cn(
                      "px-4 py-1.5 text-[11px] uppercase tracking-widest",
                      "text-white/50",
                    )}
                  >
                    {section.group}
                  </div>
                ) : null}
                {section.hits.map((hit) => {
                  const isSelected = hit.command.id === selectedId;
                  return (
                    <CommandRow
                      key={hit.command.id}
                      hit={hit}
                      selected={isSelected}
                      onMouseEnter={() => {
                        const idx = hits.findIndex(
                          (h) => h.command.id === hit.command.id,
                        );
                        if (idx >= 0) setSelectedIndex(idx);
                      }}
                      onClick={(modifier) => runSelected(hit, modifier)}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2 px-4 py-2",
            "border-t border-white/[0.06]",
            "bg-[var(--color-bg-secondary)]",
            "text-[11px] text-white/50",
          )}
        >
          <div className="flex items-center gap-3">
            <HintKey label="↵" text="select" />
            <HintKey label="↑ ↓" text="navigate" />
            <HintKey label="esc" text="close" />
          </div>
          <div className="flex items-center gap-1">
            <CommandGlyph className={cn(ICON_SIZE_SM, "text-white/45")} />
            <span>Command Palette</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HintKey({ label, text }: { label: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd
        className={cn(
          "inline-flex items-center px-1.5 py-0.5",
          "border border-white/[0.06] bg-white/[0.02]",
          "text-[11px] text-white/40",
        )}
      >
        {label}
      </kbd>
      <span>{text}</span>
    </span>
  );
}

type CommandRowProps = {
  readonly hit: CommandSearchHit;
  readonly selected: boolean;
  readonly onMouseEnter: () => void;
  readonly onClick: (modifier: boolean) => void;
};

function CommandRow({ hit, selected, onMouseEnter, onClick }: CommandRowProps) {
  const { command, matchIndices } = hit;
  return (
    <div
      id={LIST_ITEM_ID(command.id)}
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      data-cmd-id={command.id}
      data-testid={`command-row-${command.id}`}
      data-selected={selected ? "true" : "false"}
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => {
        // prevent blur of input before click handler fires
        e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e.metaKey || e.ctrlKey);
        }
      }}
      onClick={(e) => onClick(e.metaKey || e.ctrlKey)}
      className={cn(
        "flex items-center gap-3 px-4 py-2 cursor-pointer select-none",
        "text-[11px] text-white/70",
        selected
          ? "bg-white/[0.06] text-white"
          : "hover:bg-white/[0.06] hover:text-white/90",
      )}
    >
      {command.icon ? (
        <span className="shrink-0 text-white/40">{command.icon}</span>
      ) : null}
      <div className="flex flex-1 flex-col min-w-0">
        <span className="truncate">
          <HighlightedText text={command.title} indices={matchIndices} />
        </span>
        {command.subtitle ? (
          <span className="truncate text-[11px] text-white/50">
            {command.subtitle}
          </span>
        ) : null}
      </div>
      {command.shortcut ? (
        <kbd
          className={cn(
            "shrink-0 px-1.5 py-0.5",
            "border border-white/[0.06] bg-white/[0.02]",
            "text-[11px] text-white/40 tracking-widest",
          )}
        >
          {command.shortcut}
        </kbd>
      ) : null}
    </div>
  );
}

function HighlightedText({
  text,
  indices,
}: {
  text: string;
  indices: ReadonlyArray<number>;
}) {
  if (indices.length === 0) return <>{text}</>;
  const set = new Set(indices);
  const out: React.ReactNode[] = [];
  let buffer = "";
  let bufferKind: "match" | "plain" | null = null;
  let segmentStart = 0;

  const flush = (endExclusive: number) => {
    if (buffer.length === 0) return;
    if (bufferKind === "match") {
      out.push(
        <mark
          key={`m-${segmentStart}-${endExclusive}`}
          className="bg-transparent text-white font-medium"
        >
          {buffer}
        </mark>,
      );
    } else {
      out.push(<span key={`p-${segmentStart}-${endExclusive}`}>{buffer}</span>);
    }
    buffer = "";
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? "";
    const kind: "match" | "plain" = set.has(i) ? "match" : "plain";
    if (bufferKind === null) {
      bufferKind = kind;
      segmentStart = i;
      buffer = ch;
    } else if (bufferKind === kind) {
      buffer += ch;
    } else {
      flush(i);
      bufferKind = kind;
      segmentStart = i;
      buffer = ch;
    }
  }
  flush(text.length);
  return <>{out}</>;
}

type Section = {
  readonly group: string | null;
  readonly hits: ReadonlyArray<CommandSearchHit>;
};

function groupHits(
  hits: ReadonlyArray<CommandSearchHit>,
): ReadonlyArray<Section> {
  const map = new Map<string | null, CommandSearchHit[]>();
  const order: Array<string | null> = [];
  for (const hit of hits) {
    const key = hit.command.group ?? null;
    const arr = map.get(key);
    if (arr) {
      arr.push(hit);
    } else {
      map.set(key, [hit]);
      order.push(key);
    }
  }
  return order.map((group) => {
    const arr = map.get(group);
    const hitsForGroup: ReadonlyArray<CommandSearchHit> = arr ?? [];
    return { group, hits: hitsForGroup };
  });
}

// Helper re-exports for tests.
export const __testing = { groupHits, buildHistoryHits };

function buildHistoryHits(
  recentIds: string[],
  frequentIds: string[],
  registry: { get(id: string): Command | undefined },
): CommandSearchHit[] {
  const seen = new Set<string>();
  const result: CommandSearchHit[] = [];

  for (const id of recentIds) {
    const command = registry.get(id);
    if (!command) continue;
    seen.add(id);
    result.push({
      command: { ...command, group: "Recent" },
      score: 0,
      matchIndices: [],
    });
  }

  for (const id of frequentIds) {
    if (seen.has(id)) continue;
    const command = registry.get(id);
    if (!command) continue;
    result.push({
      command: { ...command, group: "Frequent" },
      score: 0,
      matchIndices: [],
    });
  }

  return result;
}

// Re-export Command type for convenience.
export type { Command };
