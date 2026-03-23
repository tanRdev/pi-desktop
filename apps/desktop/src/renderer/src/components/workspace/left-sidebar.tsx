import type { RepositorySnapshot, WorktreeSnapshot } from "@pidesk/shared";
import { FolderPlus } from "lucide-react";
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
        "relative z-10 flex h-full shrink-0 overflow-hidden border-r border-[#474747]/18 bg-[#0c0c0c] pb-6",
        "transition-[width] duration-150 ease-[var(--ease-out)]",
        isCollapsed && "overflow-hidden",
        className,
      )}
      style={{
        width: isCollapsed ? 0 : width,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col pb-6">
        {!isCollapsed && (
          <div className="border-b border-[#474747]/15 px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6f6f6f]">
              Sidecar
            </p>
            <h2 className="mt-2 text-base font-medium text-white">
              {repositoryLabel}
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-[#8a8a8a]">
              Supporting context only: open files, notes, terminal, or git when
              the thread needs it.
            </p>
          </div>
        )}

        {!repository ? (
          <div className="px-4 pt-4">
            <div className="chrome-empty-state px-4 py-5 text-sm text-[#7a7a7a]">
              Add a repository to start a workspace.
            </div>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 px-4 py-4">
            <div className="space-y-3">
              <div className="border border-[#474747]/16 bg-[#101010] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6f6f6f]">
                    Active worktree
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#8a8a8a]">
                    {worktrees.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {worktrees.length > 0 ? (
                    worktrees.map((worktree) => {
                      const isActive = worktree.id === activeWorktreeId;

                      return (
                        <button
                          key={worktree.id}
                          type="button"
                          onClick={() => onSelectWorktree(worktree.id)}
                          className={cn(
                            "flex w-full flex-col gap-2 border px-3 py-3 text-left transition-colors",
                            isActive
                              ? "border-[#474747]/30 bg-[#171717]"
                              : "border-[#474747]/14 bg-[#0d0d0d] hover:border-[#474747]/28 hover:bg-[#141414]",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium text-white">
                              {worktree.label}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#7a7a7a]">
                              {worktree.git.branch ?? "Detached"}
                            </span>
                          </div>
                          <span className="truncate text-[12px] leading-5 text-[#8a8a8a]">
                            {formatGitSummary(worktree)}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="chrome-empty-state px-4 py-4 text-sm text-[#7a7a7a]">
                      No worktrees available.
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-[#474747]/16 bg-[#101010] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6f6f6f]">
                    Focused thread
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#8a8a8a]">
                    {activeThreadId ? "Live" : "Idle"}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
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
                            className="flex w-full flex-col gap-1 border border-[#474747]/24 bg-[#171717] px-3 py-3 text-left"
                          >
                            <span className="truncate text-sm font-medium text-white">
                              {thread.title}
                            </span>
                            <span className="truncate text-[12px] text-[#8a8a8a]">
                              {worktree.label}
                            </span>
                          </button>
                        )),
                    )
                  ) : (
                    <div className="chrome-empty-state px-4 py-4 text-sm text-[#7a7a7a]">
                      Pick a thread from the first column to start chatting.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {!isCollapsed && showNewWorktreeButton && (
          <div className="mb-6 border-t border-[#474747]/15 px-4 py-3">
            <button
              type="button"
              className={cn(
                "flex h-9 w-full items-center gap-2 border border-[#474747]/16 bg-[#131313] px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8a8a8a]",
                "transition-[transform,background-color,color] duration-150 ease-out",
                "hover:bg-[#181818] hover:text-white active:scale-[0.99]",
              )}
              onClick={onCreateWorktree}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              New worktree
            </button>
          </div>
        )}
      </div>

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
