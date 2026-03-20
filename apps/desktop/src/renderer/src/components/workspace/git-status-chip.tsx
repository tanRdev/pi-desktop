import type { WorktreeGitSnapshot } from "@pidesk/shared";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  GitFork,
  Loader2,
  Pencil,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface GitStatusChipProps {
  git: WorktreeGitSnapshot;
  className?: string;
}

const iconClass = "h-3 w-3 transition-all duration-[var(--duration-fast)] motion-reduce:transition-none";
const iconStyle = { transitionTimingFunction: "var(--ease-out)" };

export function GitStatusChip({ git, className }: GitStatusChipProps) {
  // Hide completely if clean (no changes, no ahead/behind)
  if (git.status === "ready" && !git.hasChanges && !git.ahead && !git.behind) {
    return null;
  }

  // Not ready states
  if (git.status !== "ready") {
    const statusIcons: Record<string, React.ReactNode> = {
      loading: (
        <Loader2 className={cn(iconClass, "animate-spin text-amber-400")} />
      ),
      error: <AlertCircle className={cn(iconClass, "text-rose-400")} />,
      disconnected: <WifiOff className={cn(iconClass, "text-amber-400")} />,
      starting: (
        <Loader2 className={cn(iconClass, "animate-spin text-sky-400")} />
      ),
      missing: <AlertCircle className={cn(iconClass, "text-rose-400")} />,
      unavailable: <WifiOff className={cn(iconClass, "text-amber-400")} />,
    };
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-[var(--duration-fast)] motion-reduce:transition-none",
          "hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          className,
        )}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        {statusIcons[git.status] ?? (
          <AlertCircle className={cn(iconClass, "text-amber-400")} style={iconStyle} />
        )}
      </span>
    );
  }

  // Ready + has local changes (dirty)
  if (git.hasChanges) {
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-[var(--duration-fast)] motion-reduce:transition-none",
          "hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          className,
        )}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        <Pencil className={cn(iconClass, "text-amber-400")} style={iconStyle} />
      </span>
    );
  }

  // Ready, clean, but ahead and/or behind remote
  const ahead = git.ahead ?? 0;
  const behind = git.behind ?? 0;

  if (ahead > 0 && behind > 0) {
    // Diverged — local and remote have diverged
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-[var(--duration-fast)] motion-reduce:transition-none",
          "hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          className,
        )}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        <GitFork className={cn(iconClass, "text-violet-400")} style={iconStyle} />
      </span>
    );
  }

  if (ahead > 0) {
    // Ahead of remote — needs push
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-[var(--duration-fast)] motion-reduce:transition-none",
          "hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          className,
        )}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        <ArrowUp className={cn(iconClass, "text-sky-400")} style={iconStyle} />
      </span>
    );
  }

  // Behind remote — needs pull
  return (
    <span
      className={cn(
        "shrink-0",
        "transition-all duration-[var(--duration-fast)] motion-reduce:transition-none",
        "hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
        className,
      )}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <ArrowDown className={cn(iconClass, "text-orange-400")} style={iconStyle} />
    </span>
  );
}
