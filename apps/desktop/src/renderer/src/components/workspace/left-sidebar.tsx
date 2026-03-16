import type { RepositorySnapshot } from "@pidesk/shared";
import { Plus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { WorktreeSection } from "./worktree-section";

export interface LeftSidebarProps {
  repository: RepositorySnapshot | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: (worktreeId: string) => void;
  onCreateWorktree: () => void;
  onShowArchived: () => void;
  width: number;
  onResize: (width: number) => void;
  className?: string;
}

export function LeftSidebar({
  repository,
  activeWorktreeId,
  activeThreadId,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCreateWorktree,
  onShowArchived,
  width,
  onResize,
  className,
}: LeftSidebarProps) {
  // Track expanded worktree - only one can be expanded at a time
  const [expandedWorktreeId, setExpandedWorktreeId] = React.useState<
    string | null
  >(activeWorktreeId);

  // Update expanded worktree when active changes
  React.useEffect(() => {
    if (activeWorktreeId) {
      setExpandedWorktreeId(activeWorktreeId);
    }
  }, [activeWorktreeId]);

  const [isResizing, setIsResizing] = React.useState(false);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - 64; // Subtract LeftRail width
      onResize(Math.max(140, Math.min(400, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onResize]);

  const handleToggleWorktree = (worktreeId: string) => {
    if (expandedWorktreeId === worktreeId) {
      // Collapse if already expanded
      setExpandedWorktreeId(null);
    } else {
      // Expand and select the worktree
      setExpandedWorktreeId(worktreeId);
      onSelectWorktree(worktreeId);
    }
  };

  const worktrees = repository?.worktrees ?? [];

  return (
    <aside
      className={cn(
        "relative z-10 flex h-full shrink-0 flex-col border-r border-border bg-surface-1",
        className,
      )}
      style={{ width }}
    >
      {/* Header with repository name */}
      <div className="flex h-12 items-center border-b border-border px-3">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {repository?.name ?? "No project"}
        </span>
      </div>

      {/* Worktree list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1">
          {worktrees.map((worktree) => (
            <WorktreeSection
              key={worktree.id}
              worktree={worktree}
              activeWorktreeId={activeWorktreeId}
              activeThreadId={activeThreadId}
              isExpanded={expandedWorktreeId === worktree.id}
              onToggleExpand={() => handleToggleWorktree(worktree.id)}
              onSelectThread={onSelectThread}
              onCreateThread={() => onCreateThread(worktree.id)}
            />
          ))}

          {worktrees.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No worktrees
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom actions */}
      <div className="border-t border-border p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Create worktree"
          className="h-7 w-full justify-start gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onCreateWorktree}
        >
          <Plus className="h-3.5 w-3.5" />
          Add worktree
        </Button>

        <button
          type="button"
          onClick={onShowArchived}
          className="mt-1 flex h-7 w-full items-center justify-center text-[10px] text-muted-foreground opacity-60 transition hover:text-foreground hover:opacity-100"
        >
          Show archived
        </button>
      </div>
      {/* Resize handle */}
      <div
        className={cn("absolute right-0 top-0 bottom-0 w-1 cursor-col-resize")}
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize"
      />
    </aside>
  );
}
