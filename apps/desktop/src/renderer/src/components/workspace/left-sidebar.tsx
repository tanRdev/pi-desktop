import type {
  RepositoryDisplayMetadata,
  RepositorySnapshot,
} from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { ProjectAvatar } from "./project-avatar";
import { ProjectCustomizationMenu } from "./project-customization-menu";
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
  width: number;
  onResize: (width: number) => void;
  className?: string;
}

export function LeftSidebar({
  repository,
  activeWorktreeId,
  activeThreadId,
  onUpdateRepositoryPreferences,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCloseThread,
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
      <div className="border-b border-border px-3 py-2">
        {repository ? (
          <div className="group flex items-center gap-2.5">
            <ProjectAvatar
              repository={repository}
              isActive
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {repository.name}
                </span>
                <ProjectCustomizationMenu
                  repository={repository}
                  updateRepositoryPreferences={onUpdateRepositoryPreferences}
                  align="end"
                  className="project-customization-trigger opacity-0 group-hover:opacity-100"
                />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {repository.defaultBranch && (
                  <span>{repository.defaultBranch}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="chrome-empty-state px-3 py-4 text-sm">
            Add a repository to start a workspace.
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 py-2">
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
              onCloseThread={onCloseThread}
            />
          ))}

          {worktrees.length === 0 && (
            <div className="chrome-empty-state px-3 py-4 text-center text-xs">
              No worktrees
            </div>
          )}
        </div>
      </ScrollArea>

      <div
        className={cn("absolute right-0 top-0 bottom-0 w-1 cursor-col-resize")}
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize"
        role="presentation"
        aria-hidden="true"
      />
    </aside>
  );
}
