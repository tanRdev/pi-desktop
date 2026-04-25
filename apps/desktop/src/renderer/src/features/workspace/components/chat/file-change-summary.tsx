import { GitDiff } from "@phosphor-icons/react";
import { cn } from "@pi-desktop/ui";
import * as React from "react";

export interface FileChangeSummaryProps {
  filePaths: string[];
  count: number;
}

export function FileChangeSummary({
  filePaths,
  count,
}: FileChangeSummaryProps) {
  const [expanded, setExpanded] = React.useState(false);
  const hasPaths = filePaths.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-2">
      <button
        type="button"
        onClick={() => hasPaths && setExpanded((v) => !v)}
        disabled={!hasPaths}
        className={cn(
          "inline-flex items-center gap-2 border border-white/[0.06] bg-white/[0.01] px-2.5 py-1",
          "font-mono text-[11px] uppercase tracking-wider text-white/50",
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
          {filePaths.map((path, i) => (
            <li
              key={`${path}-${i}`}
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
