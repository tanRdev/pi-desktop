import type { MentionSuggestion, SlashSuggestion } from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import * as React from "react";
import {
  AtSign,
  File,
  MessageSquare,
  Terminal,
  TerminalWindow,
  Wrench,
} from "@/components/ui/phosphor-icons";

export type PromptAutocompleteProps = {
  visible?: boolean;
  suggestions: (SlashSuggestion | MentionSuggestion)[];
  selectedIndex?: number;
  onSelect?: (s: SlashSuggestion | MentionSuggestion) => void;
  onHover?: (index: number) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  className?: string;
};

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
        return <File className="size-5 shrink-0 text-white/50" />;
      case "terminal":
        return <Terminal className="size-5 shrink-0 text-amber-400" />;
      case "thread":
        return <MessageSquare className="size-5 shrink-0 text-white/50" />;
      default:
        return <AtSign className="size-5 shrink-0 text-white/50" />;
    }
  }

  switch (suggestion.kind) {
    case "skill":
      return <Wrench className="size-4 shrink-0 text-indigo-400/70" />;
    case "command":
      return <TerminalWindow className="size-4 shrink-0 text-emerald-400/70" />;
    case "prompt":
      return <MessageSquare className="size-4 shrink-0 text-sky-400/70" />;
    case "model":
      return <Terminal className="size-4 shrink-0 text-white/50" />;
    default:
      return <Terminal className="size-4 shrink-0 text-white/50" />;
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
  const listRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (selectedRef.current && listRef.current) {
      const list = listRef.current;
      const selected = selectedRef.current;
      const listRect = list.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();

      if (selectedRect.bottom > listRect.bottom) {
        list.scrollTop += selectedRect.bottom - listRect.bottom;
      } else if (selectedRect.top < listRect.top) {
        list.scrollTop -= listRect.top - selectedRect.top;
      }
    }
  });

  if (!visible) return null;

  const groups = groupSuggestions(suggestions);

  return (
    <div
      role="listbox"
      tabIndex={0}
      onKeyDown={onKeyDown}
      ref={listRef}
      className={cn(
        "z-50 max-h-[min(24rem,60vh)] w-72 overflow-y-auto border border-white/[0.06] bg-[var(--color-bg-secondary)] p-1 text-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
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
            const label = SECTION_LABELS[group.kind] ?? group.kind;

            return (
              <div key={group.kind}>
                {/* Section header */}
                <div className="px-3 pb-1 pt-2 text-[11px] font-normal uppercase tracking-[0.12em] text-white/50 select-none">
                  {label}
                </div>

                <ul className="divide-y divide-white/[0.04]">
                  {group.items.map((suggestion, localIndex) => {
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
                          ref={isSelected ? selectedRef : undefined}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => onSelect?.(suggestion)}
                          onMouseEnter={() => onHover?.(globalIndex)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                            "transition-all duration-150 ease-[var(--ease-out)]",
                            "hover:bg-white/[0.06] hover:text-white/80",
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PromptAutocomplete;
