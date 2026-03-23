import type { WorktreeSnapshot } from "@pidesk/shared";
import {
  Activity,
  FolderTree,
  GitBranch,
  Search,
  Settings2,
  Terminal,
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
  onSelectWorktree: (worktreeId: string) => void | Promise<void>;
  onOpenLauncher: () => void;
  onOpenFileTree: () => void;
  onOpenTerminal: () => void;
  onOpenGit: () => void;
  onOpenActivity: () => void;
  onOpenSettings: () => void;
  activeSurfaceKind: string | null;
}

export function TitleBar({
  projectName,
  platform,
  activeWorktreeLabel,
  worktrees,
  activeWorktreeId,
  isMainWindowFullscreen,
  onSelectWorktree,
  onOpenLauncher,
  onOpenFileTree,
  onOpenTerminal,
  onOpenGit,
  onOpenActivity,
  onOpenSettings,
  activeSurfaceKind,
}: TitleBarProps) {
  const leftPadding = getTitleBarLeftPadding({
    isFullscreen: isMainWindowFullscreen,
    platform,
  });
  const canOpenFileTree = Boolean(activeWorktreeId);

  const actions: Array<{
    label: string;
    icon: typeof Search;
    onClick: () => void;
    disabled?: boolean;
    isActive?: boolean;
  }> = [
    {
      label: "Open launcher",
      icon: Search,
      onClick: onOpenLauncher,
    },
    {
      label: canOpenFileTree
        ? "Browse files"
        : "Select a worktree to browse files",
      icon: FolderTree,
      onClick: onOpenFileTree,
      disabled: !canOpenFileTree,
      isActive: false,
    },
    {
      label: "Open terminal",
      icon: Terminal,
      onClick: onOpenTerminal,
      isActive: activeSurfaceKind === "terminal",
    },
    {
      label: "Open git",
      icon: GitBranch,
      onClick: onOpenGit,
      isActive: activeSurfaceKind === "git",
    },
    {
      label: "Open activity",
      icon: Activity,
      onClick: onOpenActivity,
      isActive: activeSurfaceKind === "activity",
    },
    {
      label: "Open settings",
      icon: Settings2,
      onClick: onOpenSettings,
    },
  ];

  return (
    <div
      data-testid="title-bar"
      data-drag-region="true"
      className="titlebar relative z-50 flex h-12 shrink-0 items-center gap-4 border-b border-[#474747]/24 bg-[#0d0d0d] px-4"
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-3"
        data-slot="titlebar-project"
        style={{ paddingLeft: `${leftPadding}px` }}
      >
        <div className="min-w-0 space-y-0.5" data-no-drag="true">
          <p
            data-testid="titlebar-project-name"
            className="truncate text-sm font-medium text-white"
          >
            {projectName}
          </p>
        </div>

        {worktrees.length > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-no-drag="true"
                className={cn(
                  "flex min-w-0 items-center gap-2 border border-[#474747]/20 bg-[#111111] px-2.5 py-1.5",
                  "text-left text-[10px] font-mono uppercase tracking-[0.08em] text-[#8a8a8a]",
                  "transition-colors hover:border-white/35 hover:text-white",
                )}
                aria-label="Select worktree"
              >
                <GitBranch className="size-3.5 shrink-0" />
                <span className="max-w-[16rem] truncate">
                  {activeWorktreeLabel ?? "Select worktree"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1">
              <div className="space-y-1">
                {worktrees.map((worktree) => {
                  const isActive = worktree.id === activeWorktreeId;

                  return (
                    <button
                      key={worktree.id}
                      type="button"
                      onClick={() => void onSelectWorktree(worktree.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[10px] uppercase tracking-[0.08em]",
                        isActive
                          ? "bg-white text-black"
                          : "text-[#b8b8b8] hover:bg-[#1f1f1f] hover:text-white",
                      )}
                    >
                      <span className="truncate">{worktree.label}</span>
                      {isActive ? <span>Current</span> : null}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      <div
        className="flex shrink-0 items-center gap-2"
        data-slot="titlebar-controls"
        data-no-drag="true"
      >
        <div className="flex items-center gap-1">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Button
                key={action.label}
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={action.onClick}
                disabled={action.disabled}
                aria-label={action.label}
                title={action.label}
                className={cn(
                  "border border-[#474747]/20 bg-[#111111] text-[#8a8a8a] hover:border-white/35 hover:bg-[#171717] hover:text-white",
                  action.isActive &&
                    "border-white/55 bg-white text-black hover:bg-white hover:text-black",
                )}
              >
                <Icon className="size-3.5" />
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
