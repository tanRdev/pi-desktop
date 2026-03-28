import { FolderPlus } from "@phosphor-icons/react";
import type { RepositorySnapshot, WorktreeSnapshot } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { LEFT_RAIL_WIDTH } from "./left-rail";

const MIN_SIDEBAR_WIDTH = 140;
const MAX_SIDEBAR_WIDTH = 400;

function clampSidebarWidth(width: number): number {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
}

function getRepositoryLabel(repository: RepositorySnapshot | null): string {
  if (!repository) {
    return "Workspace";
  }

  return repository.customName ?? repository.name;
}

function formatGitSummary(worktree: WorktreeSnapshot): string {
  if (worktree.git.status !== "ready") {
    return worktree.git.message ?? "Git unavailable";
  }

  const parts: string[] = [];

  if (worktree.git.stagedCount > 0) {
    parts.push(`${worktree.git.stagedCount} staged`);
  }

  if (worktree.git.modifiedCount > 0) {
    parts.push(`${worktree.git.modifiedCount} modified`);
  }

  if (worktree.git.untrackedCount > 0) {
    parts.push(`${worktree.git.untrackedCount} untracked`);
  }

  if (parts.length === 0) {
    parts.push("Clean");
  }

  if ((worktree.git.ahead ?? 0) > 0 || (worktree.git.behind ?? 0) > 0) {
    parts.push(`A${worktree.git.ahead ?? 0}/B${worktree.git.behind ?? 0}`);
  }

  return parts.join("  |  ");
}

export interface LeftSidebarProps {
  repository: RepositorySnapshot | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  onSelectWorktree: (worktreeId: string) => void;
  onCreateWorktree: () => void;
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
  onCreateWorktree,
  width,
  onResize,
  isCollapsed,
  className,
}: LeftSidebarProps) {
  const [isResizing, setIsResizing] = React.useState(false);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const leftRailRight =
        document
          .querySelector('[data-testid="left-rail"]')
          ?.getBoundingClientRect().right ?? LEFT_RAIL_WIDTH;
      const newWidth = e.clientX - leftRailRight;
      onResize(clampSidebarWidth(newWidth));
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

  const worktrees = repository?.worktrees ?? [];
  const repositoryLabel = getRepositoryLabel(repository);
  const showNewWorktreeButton = repository !== null;

  return (
    <aside
      data-testid="left-sidebar"
      data-state={isCollapsed ? "collapsed" : "expanded"}
      className={cn(
        "relative z-10 flex h-full shrink-0 overflow-hidden bg-[#0f0f0f]",
        "border-r border-[#2a2a2a]",
        "transition-[width] duration-200 ease-out",
        isCollapsed && "overflow-hidden",
        className,
      )}
      style={{
        width: isCollapsed ? 0 : width,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {!isCollapsed && (
          <div className="border-b border-[#2a2a2a] px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Sidecar</p>
            <h2 className="mt-1 text-sm font-medium text-foreground">
              {repositoryLabel}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Supporting context: files, terminal, or git
            </p>
          </div>
        )}

        {!repository ? (
          <div className="px-4 pt-4">
            <div className="rounded-md bg-[#141414] px-4 py-4 text-sm text-muted-foreground">
              Add a repository to start
            </div>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-3 py-3">
            <div className="space-y-3">
              <div className="rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Worktrees
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {worktrees.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {worktrees.length > 0 ? (
                    worktrees.map((worktree) => {
                      const isActive = worktree.id === activeWorktreeId;

                      return (
                        <button
                          key={worktree.id}
                          type="button"
                          onClick={() => onSelectWorktree(worktree.id)}
                          className={cn(
                            "flex w-full flex-col gap-1 rounded-md px-2 py-2 text-left transition-colors",
                            isActive
                              ? "bg-[#1a1a1a] text-foreground"
                              : "hover:bg-[#1a1a1a]/50 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {worktree.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {worktree.git.branch ?? "Detached"}
                            </span>
                          </div>
                          <span className="truncate text-xs text-muted-foreground">
                            {formatGitSummary(worktree)}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-md bg-[#1a1a1a] px-3 py-3 text-sm text-muted-foreground">
                      No worktrees
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Active thread
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {activeThreadId ? "Live" : "Idle"}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {activeThreadId ? (
                    worktrees.flatMap((worktree) =>
                      worktree.threads
                        .filter(
                          (thread) =>
                            !thread.isArchived && thread.id === activeThreadId,
                        )
                        .map((thread) => (
                          <button
                            key={thread.id}
                            type="button"
                            className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left bg-[#1a1a1a]"
                          >
                            <span className="truncate text-sm font-medium text-foreground">
                              {thread.title}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {worktree.label}
                            </span>
                          </button>
                        )),
                    )
                  ) : (
                    <div className="rounded-md bg-[#1a1a1a] px-3 py-3 text-sm text-muted-foreground">
                      Select a thread to begin
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {!isCollapsed && showNewWorktreeButton && (
          <div className="border-t border-[#2a2a2a] px-3 py-2">
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#1a1a1a] hover:text-foreground"
              onClick={onCreateWorktree}
            >
              <FolderPlus className="size-4" />
              New worktree
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize",
            "hover:bg-[#3a3a3a] transition-colors duration-150",
            isResizing && "bg-[#505050]",
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
