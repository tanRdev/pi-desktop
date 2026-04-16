import type { MentionSuggestion, SlashSuggestion } from "@pi-desktop/shared";
import * as React from "react";
import {
  AtSign,
  Command,
  Faders,
  File,
  MessageSquare,
  Terminal,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type PromptAutocompleteProps = {
  visible?: boolean;
  suggestions: (SlashSuggestion | MentionSuggestion)[];
  selectedIndex?: number;
  onSelect?: (s: SlashSuggestion | MentionSuggestion) => void;
  onHover?: (index: number) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  className?: string;
};

/** Max items shown per section before "Show N more" */
const MAX_PER_SECTION = 5;

const SECTION_LABELS: Record<string, string> = {
  skill: "Skills",
  command: "Commands",
  prompt: "Modes",
  model: "Models",
  file: "Files",
  terminal: "Terminals",
  thread: "Threads",
};

function isMentionSuggestion(
  suggestion: SlashSuggestion | MentionSuggestion,
): suggestion is MentionSuggestion {
  return "id" in suggestion;
}

function renderIcon(suggestion: SlashSuggestion | MentionSuggestion) {
  if (isMentionSuggestion(suggestion)) {
    switch (suggestion.kind) {
      case "file":
        return <File className="size-5 shrink-0 text-white/30" />;
      case "terminal":
        return <Terminal className="size-5 shrink-0 text-amber-400" />;
      case "thread":
        return <MessageSquare className="size-5 shrink-0 text-white/30" />;
      default:
        return <AtSign className="size-5 shrink-0 text-white/30" />;
    }
  }

  switch (suggestion.kind) {
    case "skill":
      return <Faders className="size-5 shrink-0 text-indigo-400/70" />;
    case "prompt":
      return <MessageSquare className="size-5 shrink-0 text-sky-400/70" />;
    case "model":
      return <Command className="size-5 shrink-0 text-white/30" />;
    default:
      return <Command className="size-5 shrink-0 text-white/30" />;
  }
}

type GroupEntry = {
  kind: string;
  items: (SlashSuggestion | MentionSuggestion)[];
  /** Start index in the flat suggestions array */
  startIndex: number;
};

function groupSuggestions(
  suggestions: (SlashSuggestion | MentionSuggestion)[],
): GroupEntry[] {
  const kindOrder = [
    "skill",
    "command",
    "prompt",
    "model",
    "file",
    "terminal",
    "thread",
  ];
  const map = new Map<
    string,
    { items: (SlashSuggestion | MentionSuggestion)[]; startIndex: number }
  >();

  let cursor = 0;
  for (const s of suggestions) {
    const k = s.kind;
    if (!map.has(k)) {
      map.set(k, { items: [], startIndex: cursor });
    }
    const group = map.get(k);
    if (group) {
      group.items.push(s);
    }
    cursor++;
  }

  // Sort by canonical order, unknown kinds appended
  const sorted: GroupEntry[] = [];
  let offset = 0;
  for (const kind of kindOrder) {
    const entry = map.get(kind);
    if (entry) {
      sorted.push({ kind, items: entry.items, startIndex: offset });
      offset += entry.items.length;
    }
  }
  for (const [kind, { items }] of map) {
    if (!kindOrder.includes(kind)) {
      sorted.push({ kind, items, startIndex: offset });
      offset += items.length;
    }
  }

  return sorted;
}

export function PromptAutocomplete({
  visible = false,
  suggestions,
  selectedIndex = -1,
  onSelect,
  onHover,
  onKeyDown,
  className,
}: PromptAutocompleteProps) {
  const [expandedKinds, setExpandedKinds] = React.useState<Set<string>>(
    new Set(),
  );

  if (!visible) return null;

  const groups = groupSuggestions(suggestions);

  const toggleExpand = (kind: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  };

  return (
    <div
      role="listbox"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(
        "z-50 w-72 overflow-hidden border border-white/[0.06] bg-[var(--color-bg-secondary)] p-1 text-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        "origin-top",
        "animate-in fade-in-0 zoom-in-95 duration-200 ease-[var(--ease-out)]",
        "motion-reduce:animate-none motion-reduce:opacity-100",
        className,
      )}
    >
      {suggestions.length === 0 ? (
        <div className="p-2 text-sm text-white/40">No suggestions</div>
      ) : (
        <div className="space-y-0.5">
          {groups.map((group) => {
            const isExpanded = expandedKinds.has(group.kind);
            const visibleItems = isExpanded
              ? group.items
              : group.items.slice(0, MAX_PER_SECTION);
            const hiddenCount = group.items.length - visibleItems.length;
            const label = SECTION_LABELS[group.kind] ?? group.kind;

            return (
              <div key={group.kind}>
                {/* Section header */}
                <div className="px-3 pb-1 pt-2 text-[10.5px] font-normal uppercase tracking-[0.12em] text-white/25 select-none">
                  {label}
                </div>

                <ul className="divide-y divide-white/[0.04]">
                  {visibleItems.map((suggestion, localIndex) => {
                    const globalIndex = group.startIndex + localIndex;
                    const isSelected = globalIndex === selectedIndex;
                    const isMention = isMentionSuggestion(suggestion);

                    return (
                      <li
                        key={
                          isMention
                            ? suggestion.id
                            : suggestion.slash || String(globalIndex)
                        }
                        className={cn(
                          "origin-left",
                          "animate-in fade-in-0 slide-in-from-left-2 duration-200 ease-[var(--ease-out)]",
                          "motion-reduce:animate-none motion-reduce:opacity-100",
                        )}
                        style={{ animationDelay: `${globalIndex * 30}ms` }}
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => onSelect?.(suggestion)}
                          onMouseEnter={() => onHover?.(globalIndex)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                            "transition-all duration-150 ease-[var(--ease-out)]",
                            "hover:bg-white/[0.04] hover:text-white/80",
                            "active:scale-[0.97] motion-reduce:active:scale-100",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/[0.06]",
                            "motion-reduce:focus-visible:outline-none",
                            isSelected && "bg-white/[0.06]",
                          )}
                        >
                          {renderIcon(suggestion)}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-[var(--app-font-mono)] text-white/80">
                              {suggestion.name}
                            </div>
                            {isMention ? (
                              <div className="truncate text-xs text-white/40">
                                {suggestion.context ?? suggestion.kind}
                              </div>
                            ) : (
                              <div className="truncate text-xs text-white/40">
                                {suggestion.slash}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Show N more / Show less */}
                {group.items.length > MAX_PER_SECTION && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.kind)}
                    className="w-full px-3 py-1.5 text-left text-[10.5px] text-white/30 transition-colors duration-150 hover:text-white/50"
                  >
                    {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PromptAutocomplete;
