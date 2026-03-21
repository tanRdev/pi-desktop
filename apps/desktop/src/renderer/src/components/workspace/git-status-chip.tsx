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

const iconClass =
  "h-3 w-3 transition-all duration-[var(--duration-fast)] motion-reduce:transition-none";

export function GitStatusChip({ git, className }: GitStatusChipProps) {
  if (git.status === "ready" && !git.hasChanges && !git.ahead && !git.behind) {
    return null;
  }

  if (git.status !== "ready") {
    const statusIcons: Record<string, React.ReactNode> = {
      loading: (
        <Loader2 className={cn(iconClass, "animate-spin text-primary/50")} />
      ),
      error: <AlertCircle className={cn(iconClass, "text-primary")} />,
      disconnected: <WifiOff className={cn(iconClass, "text-primary/60")} />,
      starting: (
        <Loader2 className={cn(iconClass, "animate-spin text-primary/80")} />
      ),
      missing: <AlertCircle className={cn(iconClass, "text-primary")} />,
      unavailable: <WifiOff className={cn(iconClass, "text-primary/60")} />,
    };
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-[var(--duration-fast)]",
          "hover:scale-[1.1] active:scale-[0.95]",
          className,
        )}
      >
        {statusIcons[git.status] ?? (
          <AlertCircle className={cn(iconClass, "text-primary/50")} />
        )}
      </span>
    );
  }

  if (git.hasChanges) {
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-[var(--duration-fast)]",
          "hover:scale-[1.1] active:scale-[0.95]",
          className,
        )}
      >
        <Pencil className={cn(iconClass, "text-primary/80")} />
      </span>
    );
  }

  const ahead = git.ahead ?? 0;
  const behind = git.behind ?? 0;

  if (ahead > 0 && behind > 0) {
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-[var(--duration-fast)]",
          "hover:scale-[1.1] active:scale-[0.95]",
          className,
        )}
      >
        <GitFork className={cn(iconClass, "text-primary/90")} />
      </span>
    );
  }

  if (ahead > 0) {
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-[var(--duration-fast)]",
          "hover:scale-[1.1] active:scale-[0.95]",
          className,
        )}
      >
        <ArrowUp className={cn(iconClass, "text-primary")} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "shrink-0",
        "transition-all duration-[var(--duration-fast)]",
        "hover:scale-[1.1] active:scale-[0.95]",
        className,
      )}
    >
      <ArrowDown className={cn(iconClass, "text-primary/70")} />
    </span>
  );
}
