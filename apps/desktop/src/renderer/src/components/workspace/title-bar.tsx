import type { WorktreeSnapshot } from "@pidesk/shared";
import {
  FolderTree,
  GitBranch,
  PanelLeft,
  Search,
  StickyNote,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTitleBarLeftPadding } from "../../lib/title-bar-layout";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export interface TitleBarProps {
  projectName: string;
  platform: NodeJS.Platform | string | null;
  activeWorktreeLabel: string | null;
  worktrees: WorktreeSnapshot[];
  activeWorktreeId: string | null;
  isMainWindowFullscreen: boolean;
  onToggleLeftSidebar: () => void;
  onOpenLauncher: () => void;
  onOpenFileTree: () => void;
  onOpenGit: () => void;
  onOpenNote: () => void;
  onSelectWorktree: (worktreeId: string) => void | Promise<void>;
}

export function TitleBar({
  projectName,
  platform,
  activeWorktreeLabel,
  worktrees,
  activeWorktreeId,
  isMainWindowFullscreen,
  onToggleLeftSidebar,
  onOpenLauncher,
  onOpenFileTree,
  onOpenGit,
  onOpenNote,
  onSelectWorktree,
}: TitleBarProps) {
  const leftPadding = getTitleBarLeftPadding({
    isFullscreen: isMainWindowFullscreen,
    platform,
  });
  const activeWorktree =
    worktrees.find((worktree) => worktree.id === activeWorktreeId) ?? null;
  const canOpenFileTree = activeWorktree !== null;

  return (
    <div
      data-drag-region="true"
      className="titlebar relative z-50 flex h-10 shrink-0 items-center gap-3 border-b border-[#474747]/30 bg-[#0e0e0e] px-3"
    >
      <div
        className="flex min-w-0 flex-1 items-center"
        data-slot="titlebar-project"
        style={{ paddingLeft: `${leftPadding}px` }}
      >
        <div className="min-w-0" data-no-drag="true">
          <p className="truncate text-[11px] font-medium text-white">
            {projectName}
          </p>
        </div>
      </div>

      <div
        className="ml-auto flex items-center gap-2"
        data-no-drag="true"
        data-slot="titlebar-controls"
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-7 min-w-[148px] max-w-[18rem] justify-between gap-3 border border-[#474747]/25 bg-[#111111] px-2.5 text-[10px] uppercase tracking-[0.08em] text-[#9a9a9a]",
                "hover:border-[#6a6a6a] hover:bg-[#161616] hover:text-white",
              )}
              aria-label="Select worktree"
            >
              <span className="flex min-w-0 items-center gap-2">
                <GitBranch className="size-3.5 shrink-0" />
                <span className="truncate">
                  {activeWorktreeLabel ?? "No branch"}
                </span>
              </span>
              <span className="truncate text-[9px] text-[#666]">
                {activeWorktree?.git.branch ?? "detached"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-72 border-[#474747]/35 bg-[#111111] p-1 text-[10px]"
          >
            <div className="space-y-1">
              {worktrees.length === 0 ? (
                <div className="px-3 py-3 text-center text-[#6f6f6f]">
                  No worktrees available
                </div>
              ) : (
                worktrees.map((worktree) => {
                  const isActive = worktree.id === activeWorktreeId;
                  return (
                    <button
                      key={worktree.id}
                      type="button"
                      onClick={() => void onSelectWorktree(worktree.id)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 border border-transparent px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-[#474747]/35 bg-[#1b1b1b] text-white"
                          : "text-[#8a8a8a] hover:border-[#474747]/20 hover:bg-[#181818] hover:text-white",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[10px] uppercase tracking-[0.08em]">
                          {worktree.label}
                        </div>
                        <div className="mt-1 truncate text-[9px] text-[#666]">
                          {worktree.path}
                        </div>
                      </div>
                      <span className="shrink-0 text-[9px] text-[#666]">
                        {worktree.git.branch ?? "detached"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={onToggleLeftSidebar}
          className="flex size-8 items-center justify-center text-[#6f6f6f] transition-colors hover:text-white"
          aria-label="Toggle workspace sidebar"
        >
          <PanelLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={onOpenFileTree}
          className={cn(
            "flex size-8 items-center justify-center text-[#6f6f6f] transition-colors",
            canOpenFileTree
              ? "hover:text-white"
              : "cursor-not-allowed opacity-40",
          )}
          aria-label="Open file tree"
          title={
            canOpenFileTree
              ? "Browse files"
              : "Select a worktree to browse files"
          }
          disabled={!canOpenFileTree}
        >
          <FolderTree className="size-4" />
        </button>
        <button
          type="button"
          onClick={onOpenLauncher}
          className="flex size-8 items-center justify-center text-[#6f6f6f] transition-colors hover:text-white"
          aria-label="Open launcher"
        >
          <Search className="size-4" />
        </button>
        <button
          type="button"
          onClick={onOpenGit}
          className="flex size-8 items-center justify-center text-[#6f6f6f] transition-colors hover:text-white"
          aria-label="Open git view"
        >
          <Workflow className="size-4" />
        </button>
        <button
          type="button"
          onClick={onOpenNote}
          className="flex size-8 items-center justify-center text-[#6f6f6f] transition-colors hover:text-white"
          aria-label="Open notes"
        >
          <StickyNote className="size-4" />
        </button>
      </div>
    </div>
  );
}
