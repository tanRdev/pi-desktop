"use client";

import type { SearchMatch } from "@pidesk/shared";
import * as React from "react";
import { File, Folder, Loader2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const EMPTY_SEARCH_RESULTS: SearchMatch[] = [];
const EMPTY_SEARCH_ACTIONS: WorkspaceSearchAction[] = [];

export type WorkspaceSearchAction = {
  id: string;
  label: string;
  description?: string;
  onSelect: () => void;
};

export type WorkspaceSearchContentProps = {
  query: string;
  onQueryChange: (q: string) => void;
  isLoading?: boolean;
  results?: SearchMatch[];
  selectedIndex?: number;
  onSelect?: (match: SearchMatch) => void;
  onHover?: (index: number) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  actions?: WorkspaceSearchAction[];
  shouldFocusInput?: boolean;
  className?: string;
};

export function WorkspaceSearchContent({
  query,
  onQueryChange,
  isLoading = false,
  results = EMPTY_SEARCH_RESULTS,
  selectedIndex = -1,
  onSelect,
  onHover,
  onKeyDown,
  actions = EMPTY_SEARCH_ACTIONS,
  shouldFocusInput = false,
  className,
}: WorkspaceSearchContentProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (shouldFocusInput) {
      inputRef.current?.focus();
    }
  }, [shouldFocusInput]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="px-4 py-3">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search..."
          aria-label="Search"
          className={cn(
            "w-full rounded-lg border-0 bg-[#1a1a1a] px-3 py-2.5 text-sm outline-none",
            "text-foreground placeholder:text-muted-foreground",
            "focus:ring-1 focus:ring-white/20",
          )}
        />
        {actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className={cn(
                  "rounded-md bg-[#1a1a1a] px-3 py-1.5 text-xs text-foreground",
                  "transition-colors active:scale-[0.97]",
                  "hover:bg-[#252525]",
                )}
                title={action.description ?? action.label}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            {query ? "No results" : "Type to search"}
          </div>
        ) : (
          <div>
            {results.map((result, index) => {
              const isSelected = index === selectedIndex;
              const Icon = result.type === "directory" ? Folder : File;

              return (
                <button
                  key={result.path}
                  type="button"
                  onClick={() => onSelect?.(result)}
                  onMouseEnter={() => onHover?.(index)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm",
                    "transition-colors",
                    "hover:bg-[#1a1a1a]",
                    isSelected && "bg-[#1a1a1a]",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      result.type === "directory"
                        ? "text-amber-400"
                        : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{result.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {result.path}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
