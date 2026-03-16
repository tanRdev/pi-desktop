import type { WorktreeGitSnapshot } from "@pidesk/shared";
import { AlertCircle, Loader2, Pencil, RefreshCw } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export interface GitStatusChipProps {
  git: WorktreeGitSnapshot;
  className?: string;
}

export function GitStatusChip({ git, className }: GitStatusChipProps) {
  // Hide completely if clean (no changes, no ahead/behind)
  if (git.status === "ready" && !git.hasChanges && !git.ahead && !git.behind) {
    return null;
  }

  // Not ready states
  if (git.status !== "ready") {
    const statusIcons: Record<string, React.ReactNode> = {
      loading: <Loader2 className="h-3 w-3 animate-spin text-amber-400" />,
      error: <AlertCircle className="h-3 w-3 text-rose-400" />,
      disconnected: <RefreshCw className="h-3 w-3 text-amber-400" />,
      starting: <Loader2 className="h-3 w-3 animate-spin text-sky-400" />,
      missing: <AlertCircle className="h-3 w-3 text-rose-400" />,
      unavailable: <RefreshCw className="h-3 w-3 text-amber-400" />,
    };
    return (
      <span className={cn("shrink-0", className)}>
        {statusIcons[git.status] ?? (
          <RefreshCw className="h-3 w-3 text-amber-400" />
        )}
      </span>
    );
  }

  // Ready states
  if (git.hasChanges) {
    return (
      <span className={cn("shrink-0", className)}>
        <Pencil className="h-3 w-3 text-rose-400" />
      </span>
    );
  }

  // Ahead/behind only - show sync icon
  return (
    <span className={cn("shrink-0", className)}>
      <RefreshCw className="h-3 w-3 text-emerald-400" />
    </span>
  );
}
