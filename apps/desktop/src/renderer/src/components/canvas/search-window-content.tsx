"use client";

import type { SearchMatch } from "@pidesk/shared";
import { File, Folder, Loader2 } from "@/components/ui/icons";
import * as React from "react";
import { cn } from "@/lib/utils";

const EMPTY_SEARCH_RESULTS: SearchMatch[] = [];
const EMPTY_SEARCH_ACTIONS: SearchWindowAction[] = [];

export type SearchWindowAction = {
  id: string;
  label: string;
  description?: string;
  onSelect: () => void;
};

export type SearchWindowContentProps = {
  query: string;
  onQueryChange: (q: string) => void;
  isLoading?: boolean;
  results?: SearchMatch[];
  selectedIndex?: number;
  onSelect?: (match: SearchMatch) => void;
  onHover?: (index: number) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  actions?: SearchWindowAction[];
  shouldFocusInput?: boolean;
  className?: string;
};

export function SearchWindowContent({
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
}: SearchWindowContentProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (shouldFocusInput) {
      inputRef.current?.focus();
    }
  }, [shouldFocusInput]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="border-b border-border-subtle p-3">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search workspace..."
          aria-label="Search"
          className="w-full rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-500/20"
        />
        {actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground transition hover:bg-surface-3"
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
            <span className="ml-2 text-sm text-muted-foreground">
              Searching…
            </span>
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {query
              ? "No results"
              : "Type to search or launch a workspace tool."}
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {results.map((res, i) => {
              const isSelected = i === selectedIndex;
              const Icon = res.type === "directory" ? Folder : File;
              return (
                <div key={res.path}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(res)}
                    onMouseEnter={() => onHover?.(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition",
                      "hover:bg-surface-2 hover:text-foreground",
                      isSelected && "bg-surface-2/60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        res.type === "directory" ? "text-amber-400" : "text-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-[var(--app-font-mono)]">
                        {res.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {res.path}
                      </div>
                    </div>
                    <div className="ml-2 text-xs uppercase text-muted-foreground">
                      {res.type}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
