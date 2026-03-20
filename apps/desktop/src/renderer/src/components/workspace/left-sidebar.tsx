import type {
  RepositoryDisplayMetadata,
  RepositorySnapshot,
} from "@pidesk/shared";
import { FolderPlus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { WorktreeSection } from "./worktree-section";

export interface LeftSidebarProps {
  repository: RepositorySnapshot | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  onUpdateRepositoryPreferences: (
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ) => void | Promise<void>;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: (worktreeId: string) => void;
  onCreateWorktree: () => void;
  onCloseThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
  width: number;
  onResize: (width: number) => void;
  isCollapsed: boolean;
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
  onCloseThread,
  onRenameThread,
  width,
  onResize,
  isCollapsed,
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
        "transition-[width] duration-200 ease-[var(--ease-out)]",
        "motion-reduce:transition-none",
        isCollapsed && "overflow-hidden border-r-0",
        className,
      )}
      style={{ width: isCollapsed ? 0 : width }}
    >
      {!repository ? (
        <div className="px-2 pt-2">
          <div className="chrome-empty-state px-3 py-4 text-sm">
            Add a repository to start a workspace.
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 py-2">
          {worktrees.map((worktree, index) => (
            <div
              key={worktree.id}
              className="stagger-item"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <WorktreeSection
                worktree={worktree}
                activeWorktreeId={activeWorktreeId}
                activeThreadId={activeThreadId}
                isExpanded={expandedWorktreeId === worktree.id}
                onToggleExpand={() => handleToggleWorktree(worktree.id)}
                onSelectThread={onSelectThread}
                onCreateThread={() => onCreateThread(worktree.id)}
                onCloseThread={onCloseThread}
                onRenameThread={onRenameThread}
              />
            </div>
          ))}

          {worktrees.length === 0 && (
            <div className="chrome-empty-state px-3 py-4 text-center text-sm">
              No worktrees
            </div>
          )}
        </div>
      </ScrollArea>

      {!isCollapsed && repository && (
        <div className="border-t border-border px-2 py-2">
          <button
            type="button"
            className={cn(
              "flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground",
              "transition-all duration-150 ease-[var(--ease-out)]",
              "hover:bg-surface-2 hover:text-foreground hover:translate-y-[-1px]",
              "active:scale-[0.97] active:translate-y-0",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/50 focus-visible:outline-offset-2",
              "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
            )}
            onClick={onCreateWorktree}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New worktree
          </button>
        </div>
      )}

      {!isCollapsed && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize",
            "hover:bg-ring/10 transition-colors duration-150 ease-[var(--ease-out)]",
            "motion-reduce:transition-none",
            isResizing && "bg-ring/20",
          )}
          onMouseDown={() => setIsResizing(true)}
          title="Drag to resize"
          role="presentation"
          aria-hidden="true"
        />
      )}
    </aside>
  );
}
