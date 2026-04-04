import type { WorktreeSnapshot } from "@pidesk/shared";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  GearSix,
  GitBranch,
  ICON_SIZE_MD,
  ICON_SIZE_SM,
  MagnifyingGlass,
  Pulse,
  TerminalWindow,
} from "@/components/ui/icons";
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

  return (
    <div
      data-testid="title-bar"
      data-drag-region="true"
      className={cn(
        "relative z-50 flex h-11 shrink-0 items-center gap-[var(--space-4)]",
        // Glass morphism title bar - Cursor IDE style
        "glass-titlebar",
      )}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-[var(--space-3)]"
        data-slot="titlebar-project"
        style={{ paddingLeft: `${leftPadding}px` }}
      >
        <div className="min-w-0" data-no-drag="true">
          <p
            data-testid="titlebar-project-name"
            className="truncate text-sm font-medium text-[var(--color-text-primary)]"
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
                  "flex min-w-0 items-center gap-[var(--space-1.5)] rounded-md px-[var(--space-2)] py-[var(--space-1)] text-left text-xs text-[var(--color-text-tertiary)]",
                  "transition-all duration-[var(--duration-fast)] ease-out",
                  "hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
                  "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                )}
                aria-label="Select worktree"
              >
                <GitBranch className={`${ICON_SIZE_SM} shrink-0`} />
                <span className="max-w-[12rem] truncate">
                  {activeWorktreeLabel ?? "Select worktree"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-60 p-[var(--space-1)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg shadow-lg"
            >
              <div className="space-y-[var(--space-0.5)]">
                {worktrees.map((worktree) => {
                  const isActive = worktree.id === activeWorktreeId;

                  return (
                    <button
                      key={worktree.id}
                      type="button"
                      onClick={() => void onSelectWorktree(worktree.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-[var(--space-3)] rounded-md px-[var(--space-3)] py-[var(--space-2)] text-left text-xs transition-colors duration-[var(--duration-fast)]",
                        isActive
                          ? "bg-[var(--color-accent)] text-[var(--color-text-inverse)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <span className="truncate">{worktree.label}</span>
                      {isActive ? (
                        <span className="text-xs opacity-70">Current</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      <div
        className="flex shrink-0 items-center gap-[var(--space-1)] pr-[var(--space-3)]"
        data-slot="titlebar-controls"
        data-no-drag="true"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenLauncher}
          aria-label="Search"
          title="Search"
          className={cn(
            "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
            "transition-all duration-[var(--duration-fast)] ease-out",
            activeSurfaceKind === "launcher" &&
              "bg-[var(--color-bg-quaternary)] text-[var(--color-text-primary)]",
          )}
        >
          <MagnifyingGlass className={ICON_SIZE_MD} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenFileTree}
          disabled={!canOpenFileTree}
          aria-label="Files"
          title={canOpenFileTree ? "Browse files" : "Select a worktree first"}
          className={cn(
            "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
            "transition-all duration-[var(--duration-fast)] ease-out",
            activeSurfaceKind === "file" &&
              "bg-[var(--color-bg-quaternary)] text-[var(--color-text-primary)]",
            !canOpenFileTree && "opacity-40 cursor-not-allowed",
          )}
        >
          <FolderOpen className={ICON_SIZE_MD} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenTerminal}
          aria-label="Terminal"
          title="Terminal"
          className={cn(
            "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
            "transition-all duration-[var(--duration-fast)] ease-out",
            activeSurfaceKind === "terminal" &&
              "bg-[var(--color-bg-quaternary)] text-[var(--color-text-primary)]",
          )}
        >
          <TerminalWindow className={ICON_SIZE_MD} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenGit}
          aria-label="Git"
          title="Git"
          className={cn(
            "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
            "transition-all duration-[var(--duration-fast)] ease-out",
            activeSurfaceKind === "git" &&
              "bg-[var(--color-bg-quaternary)] text-[var(--color-text-primary)]",
          )}
        >
          <GitBranch className={ICON_SIZE_MD} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenActivity}
          aria-label="Activity"
          title="Activity"
          className={cn(
            "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
            "transition-all duration-[var(--duration-fast)] ease-out",
            activeSurfaceKind === "activity" &&
              "bg-[var(--color-bg-quaternary)] text-[var(--color-text-primary)]",
          )}
        >
          <Pulse className={ICON_SIZE_MD} />
        </Button>

        <div className="mx-[var(--space-1)] h-4 w-px bg-[var(--color-border-default)]" />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className={cn(
            "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
            "transition-all duration-[var(--duration-fast)] ease-out",
          )}
        >
          <GearSix className={ICON_SIZE_MD} />
        </Button>
      </div>
    </div>
  );
}
