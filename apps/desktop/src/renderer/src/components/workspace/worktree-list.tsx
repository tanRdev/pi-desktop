import type { WorktreeSnapshot } from "@pidesk/shared";
import { GitBranch, Plus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { GitStatusChip } from "./git-status-chip";

export interface WorktreeListProps {
  worktrees: WorktreeSnapshot[];
  activeWorktreeId: string | null;
  onSelect: (worktreeId: string) => void | Promise<void>;
  onCreate: () => void | Promise<void>;
}

export function WorktreeList({
  worktrees,
  activeWorktreeId,
  onSelect,
  onCreate,
}: WorktreeListProps) {
  return (
    <section className="space-y-2 px-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Worktrees
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 rounded border border-border bg-surface-2 text-foreground",
            "transition-[transform,background-color,border-color] duration-150 ease-out",
            "hover:bg-surface-3 hover:scale-105",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/10",
            "active:scale-[0.97] active:duration-100",
          )}
          onClick={() => onCreate()}
          aria-label="Create worktree"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-1">
        {worktrees.map((worktree, index) => {
          const liveThreadCount = worktree.threads.filter(
            (thread) => thread.isArchived === false,
          ).length;

          return (
            <button
              key={worktree.id}
              type="button"
              onClick={() => onSelect(worktree.id)}
              className={cn(
                "motion-safe:stagger-item w-full rounded-lg border p-3 text-left",
                "transition-[transform,opacity,background-color,border-color,box-shadow] duration-200 ease-out",
                "hover:translate-x-0.5 hover:shadow-sm",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/10",
                "active:scale-[0.97] active:duration-100",
                worktree.id === activeWorktreeId
                  ? "border-border-hover bg-surface-2 shadow-sm"
                  : "border-border bg-surface-1 hover:bg-surface-2",
              )}
              style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium text-foreground">
                      {worktree.label}
                    </span>
                    {worktree.isMain && (
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        main
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {worktree.path}
                  </div>
                </div>
                <GitStatusChip git={worktree.git} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {liveThreadCount} live thread
                  {liveThreadCount === 1 ? "" : "s"}
                </span>
                <span>{worktree.git.branch ?? "detached"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
