import type { WorktreeSnapshot } from "@pi-desktop/shared";
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
        <p className="text-[10.5px] font-normal uppercase tracking-wider text-white/30">
          Worktrees
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 border border-white/[0.06] bg-white/[0.02] text-white/50",
            "transition-all duration-150 ease-out",
            "hover:bg-white/[0.06] hover:text-white/70",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10",
            "active:scale-[0.97] active:duration-100",
          )}
          onClick={() => onCreate()}
          aria-label="Create worktree"
        >
          <Plus className="size-5" />
        </Button>
      </div>
      <div className="space-y-1">
        {worktrees.map((worktree, index) => {
          const threadCount = worktree.threads.length;

          return (
            <button
              key={worktree.id}
              type="button"
              onClick={() => onSelect(worktree.id)}
              className={cn(
                "w-full border p-3 text-left",
                "transition-all duration-150 ease-out",
                "hover:bg-white/[0.04]",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10",
                "active:scale-[0.98] active:duration-100",
                worktree.id === activeWorktreeId
                  ? "border-white/[0.08] bg-white/[0.04]"
                  : "border-white/[0.04] bg-transparent hover:border-white/[0.06]",
              )}
              style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-5 shrink-0 text-white/30" />
                    <span className="truncate text-sm font-normal text-white/80">
                      {worktree.label}
                    </span>
                    {worktree.isMain && (
                      <span className="border border-white/[0.08] px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-white/30">
                        main
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-white/30">
                    {worktree.path}
                  </div>
                </div>
                <GitStatusChip git={worktree.git} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10.5px] text-white/30">
                <span>
                  {threadCount} thread
                  {threadCount === 1 ? "" : "s"}
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
