"use client";

import type { MentionSuggestion, SlashSuggestion } from "@pidesk/shared";
import { AtSign, Command, File, MessageSquare, Terminal } from "lucide-react";
import type * as React from "react";
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

function isMentionSuggestion(
  suggestion: SlashSuggestion | MentionSuggestion,
): suggestion is MentionSuggestion {
  return "id" in suggestion;
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
  if (!visible) return null;

  const renderIcon = (suggestion: SlashSuggestion | MentionSuggestion) => {
    if (isMentionSuggestion(suggestion)) {
      switch (suggestion.kind) {
        case "file":
          return <File className="size-3.5 shrink-0 text-muted-foreground" />;
        case "terminal":
          return <Terminal className="size-3.5 shrink-0 text-amber-400" />;
        case "thread":
          return (
            <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
          );
        default:
          return <AtSign className="size-3.5 shrink-0 text-muted-foreground" />;
      }
    }

    return <Command className="size-3.5 shrink-0 text-muted-foreground" />;
  };

  return (
    <div
      role="listbox"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(
        "z-50 w-72 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
        className,
      )}
    >
      {suggestions.length === 0 ? (
        <div className="p-2 text-sm text-muted-foreground">No suggestions</div>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {suggestions.map((suggestion, index) => {
            const isSelected = index === selectedIndex;
            const isMention = isMentionSuggestion(suggestion);

            return (
              <li
                key={
                  isMention ? suggestion.id : suggestion.slash || String(index)
                }
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelect?.(suggestion)}
                  onMouseEnter={() => onHover?.(index)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                    "hover:bg-surface-2 hover:text-foreground",
                    isSelected && "bg-surface-2/60",
                  )}
                >
                  {renderIcon(suggestion)}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-[var(--app-font-mono)]">
                      {suggestion.name}
                    </div>
                    {isMention ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {suggestion.context ?? suggestion.kind}
                      </div>
                    ) : (
                      <div className="truncate text-xs text-muted-foreground">
                        {suggestion.slash}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default PromptAutocomplete;
