import { FolderPlus } from "@phosphor-icons/react";
import type { RepositorySnapshot, WorktreeSnapshot } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { SIDEBAR_WIDTH } from "./left-rail";

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
          ?.getBoundingClientRect().right ?? SIDEBAR_WIDTH;
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
        "relative z-10 flex h-full shrink-0 overflow-hidden bg-[var(--color-bg-primary)]",
        "border-r border-white/[0.04]",
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
          <div className="border-b border-white/[0.04] px-4 py-3">
            <p className="text-[14px] font-medium text-white/30 uppercase tracking-wider">
              Sidecar
            </p>
            <h2 className="mt-1 text-[16px] font-medium text-white/80">
              {repositoryLabel}
            </h2>
            <p className="mt-1 text-[14px] text-white/30">
              Supporting context: files, terminal, or git
            </p>
          </div>
        )}

        {!repository ? (
          <div className="px-4 pt-4">
            <div className="rounded-sm bg-white/[0.02] px-4 py-4 text-sm text-white/40">
              Add a repository to start
            </div>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-3 py-3">
            <div className="space-y-3">
              <div className="rounded-sm border border-white/[0.04] bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-semibold uppercase tracking-wider text-white/40">
                    Worktrees
                  </span>
                  <span className="text-[14px] text-white/20">
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
                            "flex w-full flex-col gap-1 rounded-sm px-2 py-2 text-left transition-colors duration-[var(--duration-fast)]",
                            isActive
                              ? "bg-white/[0.06] text-white/80"
                              : "hover:bg-white/[0.04] text-white/50 hover:text-white/70",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[16px] font-medium">
                              {worktree.label}
                            </span>
                            <span className="text-[14px] text-white/30 font-mono">
                              {worktree.git.branch ?? "Detached"}
                            </span>
                          </div>
                          <span className="truncate text-[14px] text-white/30">
                            {formatGitSummary(worktree)}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-md bg-white/[0.02] px-3 py-3 text-[14px] text-white/30">
                      No worktrees
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-sm border border-white/[0.04] bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-semibold uppercase tracking-wider text-white/40">
                    Active thread
                  </span>
                  <span className="text-[14px] text-white/20">
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
                            className="flex w-full flex-col gap-0.5 rounded-sm px-2 py-2 text-left bg-white/[0.06]"
                          >
                            <span className="truncate text-[16px] font-medium text-white/80">
                              {thread.title}
                            </span>
                            <span className="truncate text-[14px] text-white/30">
                              {worktree.label}
                            </span>
                          </button>
                        )),
                    )
                  ) : (
                    <div className="rounded-md bg-white/[0.02] px-3 py-3 text-[14px] text-white/30">
                      Select a thread to begin
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {!isCollapsed && showNewWorktreeButton && (
          <div className="border-t border-white/[0.04] px-3 py-2">
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-[16px] font-medium text-white/40 transition-colors duration-[var(--duration-fast)] hover:bg-white/[0.04] hover:text-white/60"
              onClick={onCreateWorktree}
            >
              <FolderPlus className="size-5" />
              New worktree
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize",
            "hover:bg-white/[0.06] transition-colors duration-[var(--duration-fast)]",
            isResizing && "bg-white/[0.08]",
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
