import { GitDiff } from "@phosphor-icons/react";
import { cn } from "@pi-desktop/ui";
import * as React from "react";

export interface FileChangeSummaryProps {
  /** Unique paths of files changed by successful tool calls. */
  filePaths: string[];
}

export function FileChangeSummary({ filePaths }: FileChangeSummaryProps) {
  const [expanded, setExpanded] = React.useState(false);
  // Report unique files only: duplicate paths never inflate the count.
  const uniquePaths = React.useMemo(
    () => Array.from(new Set(filePaths)),
    [filePaths],
  );
  const count = uniquePaths.length;
  const hasPaths = uniquePaths.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-2">
      <button
        type="button"
        onClick={() => hasPaths && setExpanded((v) => !v)}
        disabled={!hasPaths}
        className={cn(
          "inline-flex items-center gap-2 rounded-sm border border-white/[0.06] bg-white/[0.01] px-2.5 py-1",
          "text-[11px] font-medium tracking-wide text-white/50",
          "transition-colors duration-[var(--duration-fast)]",
          hasPaths &&
            "hover:bg-white/[0.06] hover:text-white/70 cursor-pointer",
          !hasPaths && "cursor-default",
        )}
      >
        <GitDiff className="size-3.5" />
        <span>
          {count} {count === 1 ? "file changed" : "files changed"}
        </span>
      </button>
      {expanded && hasPaths && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {uniquePaths.map((path) => (
            <li
              key={path}
              className="font-mono text-[11px] text-white/50 truncate"
            >
              {path}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
