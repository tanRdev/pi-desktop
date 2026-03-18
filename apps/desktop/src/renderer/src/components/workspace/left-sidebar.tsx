import type {
  RepositoryDisplayMetadata,
  RepositorySnapshot,
} from "@pidesk/shared";
import { Plus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
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
  onCreateWorktree,
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
  const activeWorktree = worktrees.find(
    (worktree) => worktree.id === activeWorktreeId,
  );

  return (
    <aside
      className={cn(
        "relative z-10 flex h-full shrink-0 flex-col border-r border-border bg-surface-1",
        className,
      )}
      style={{ width }}
    >
      <div className="border-b border-border px-3 py-3">
        {repository ? (
          <div className="group rounded-2xl border border-border bg-surface-2/80 p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <ProjectAvatar
                repository={repository}
                isActive
                size="md"
                className="shrink-0"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="chrome-eyebrow">Repository</div>
                    <div className="truncate text-sm font-semibold text-foreground">
                      {repository.name}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {repository.rootPath}
                    </div>
                  </div>

                  <ProjectCustomizationMenu
                    repository={repository}
                    updateRepositoryPreferences={onUpdateRepositoryPreferences}
                    align="end"
                    className="project-customization-trigger"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{worktrees.length} worktrees</span>
                  {repository.defaultBranch ? (
                    <span>{repository.defaultBranch}</span>
                  ) : null}
                  {activeWorktree ? <span>{activeWorktree.label}</span> : null}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Create worktree"
                    className="h-7 gap-1.5 rounded-md border-border bg-surface-1 px-2 text-[11px] text-foreground"
                    onClick={onCreateWorktree}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New worktree
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 px-3 py-4 text-sm text-muted-foreground">
            Add a repository to start a workspace.
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 py-2">
          <div className="chrome-eyebrow px-2 pb-2">Worktrees</div>
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
            <div className="rounded-xl border border-dashed border-border bg-surface-2/40 px-3 py-4 text-center text-xs text-muted-foreground">
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
