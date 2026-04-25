import type { WorktreeGitSnapshot } from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  ICON_SIZE_SM,
  PencilSimple,
  Spinner,
  WarningCircle,
  WifiSlash,
} from "@/components/ui/phosphor-icons";

export interface GitStatusChipProps {
  git: WorktreeGitSnapshot;
  className?: string;
}

const iconClass = `${ICON_SIZE_SM} transition-all duration-150 motion-reduce:transition-none`;

export function GitStatusChip({ git, className }: GitStatusChipProps) {
  if (git.status === "ready" && !git.hasChanges && !git.ahead && !git.behind) {
    return null;
  }

  if (git.status !== "ready") {
    const statusIcons: Record<string, React.ReactNode> = {
      loading: (
        <Spinner className={cn(iconClass, "animate-spin text-white/50")} />
      ),
      error: <WarningCircle className={cn(iconClass, "text-yellow-400/60")} />,
      disconnected: <WifiSlash className={cn(iconClass, "text-white/50")} />,
      starting: (
        <Spinner className={cn(iconClass, "animate-spin text-white/40")} />
      ),
      missing: (
        <WarningCircle className={cn(iconClass, "text-yellow-400/60")} />
      ),
      unavailable: <WifiSlash className={cn(iconClass, "text-white/50")} />,
    };
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-150",
          "hover:scale-[1.1] active:scale-[0.95]",
          className,
        )}
      >
        {statusIcons[git.status] ?? (
          <WarningCircle className={cn(iconClass, "text-white/50")} />
        )}
      </span>
    );
  }

  if (git.hasChanges) {
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-150",
          "hover:scale-[1.1] active:scale-[0.95]",
          className,
        )}
      >
        <PencilSimple className={cn(iconClass, "text-yellow-400/60")} />
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
          "transition-all duration-150",
          "hover:scale-[1.1] active:scale-[0.95]",
          className,
        )}
      >
        <GitBranch className={cn(iconClass, "text-white/50")} />
      </span>
    );
  }

  if (ahead > 0) {
    return (
      <span
        className={cn(
          "shrink-0",
          "transition-all duration-150",
          "hover:scale-[1.1] active:scale-[0.95]",
          className,
        )}
      >
        <ArrowUp className={cn(iconClass, "text-[var(--color-accent)]/60")} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "shrink-0",
        "transition-all duration-150",
        "hover:scale-[1.1] active:scale-[0.95]",
        className,
      )}
    >
      <ArrowDown className={cn(iconClass, "text-white/40")} />
    </span>
  );
}
