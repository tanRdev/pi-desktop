import type { WorktreeGitSnapshot } from "@pidesk/shared";
import { cn } from "@/lib/utils";

export interface GitStatusChipProps {
  git: WorktreeGitSnapshot;
  className?: string;
}

export function GitStatusChip({ git, className }: GitStatusChipProps) {
  const label =
    git.status !== "ready"
      ? git.status
      : git.hasChanges
        ? "dirty"
        : "clean";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        git.status !== "ready"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : git.hasChanges
            ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
            : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
        className,
      )}
    >
      {label}
      {git.status === "ready" && (
        <span className="ml-1 text-[10px] text-foreground/70">
          +{git.ahead ?? 0}/-{git.behind ?? 0}
        </span>
      )}
    </span>
  );
}
