import type { RepositorySnapshot } from "@pidesk/shared";
import {
  FolderTree,
  GitBranch,
  PanelLeft,
  PanelLeftClose,
  StickyNote,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TitleBarProps {
  activeRepository: RepositorySnapshot | null;
  activeWorktreeLabel: string | null;
  sidebarView: "files" | "git" | "notes" | null;
  setSidebarView: (view: "files" | "git" | "notes" | null) => void;
  hasOpenNotes: boolean;
  isLeftSidebarCollapsed: boolean;
  onToggleLeftSidebar: () => void;
  onOpenLauncher: () => void;
  onOpenNote: () => void;
  onOpenGit: () => void;
  onOpenTerminal: () => void;
}

export function TitleBar({
  activeRepository,
  activeWorktreeLabel,
  sidebarView,
  setSidebarView,
  hasOpenNotes,
  isLeftSidebarCollapsed,
  onToggleLeftSidebar,
  onOpenLauncher,
  onOpenNote,
  onOpenGit,
  onOpenTerminal,
}: TitleBarProps) {
  return (
    <div
      data-drag-region="true"
      className="titlebar shell-chrome relative flex h-11 shrink-0 items-center justify-between pr-3"
    >
      <div className="flex min-w-0 items-center gap-2.5 pl-[88px]">
        <button
          type="button"
          data-no-drag="true"
          onClick={onToggleLeftSidebar}
          className="chrome-icon-button flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground"
          aria-label={
            isLeftSidebarCollapsed
              ? "Expand left sidebar"
              : "Collapse left sidebar"
          }
          title={isLeftSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          {isLeftSidebarCollapsed ? (
            <PanelLeft className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </button>

        <button
          type="button"
          data-no-drag="true"
          data-testid="app-title"
          onClick={onOpenLauncher}
          className="text-lg text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          aria-label="Open launcher"
          title="Pi launcher"
        >
          π
        </button>

        <div className="flex min-w-0 items-center gap-2" data-no-drag="true">
          <span
            data-testid="titlebar-project-name"
            className="truncate text-sm text-muted-foreground/80"
          >
            {activeRepository?.name ?? "No project selected"}
          </span>
          {activeWorktreeLabel ? (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span
                data-testid="titlebar-worktree-label"
                className="truncate text-sm text-muted-foreground/60"
              >
                {activeWorktreeLabel}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          data-no-drag="true"
          onClick={() =>
            setSidebarView(sidebarView === "files" ? null : "files")
          }
          className={cn(
            "chrome-icon-button flex h-8 w-8 items-center justify-center rounded-md",
            sidebarView === "files"
              ? "bg-surface-3 text-foreground"
              : "text-muted-foreground",
          )}
          aria-label="Toggle files sidebar"
          title="Files"
        >
          <FolderTree className="size-3.5" />
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenGit}
          className="chrome-icon-button flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground"
          aria-label="Open git view"
          title="Git"
        >
          <GitBranch className="size-3.5" />
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenNote}
          className={cn(
            "chrome-icon-button flex h-8 w-8 items-center justify-center rounded-md",
            hasOpenNotes
              ? "bg-surface-3 text-foreground"
              : "text-muted-foreground",
          )}
          aria-label="Open notes"
          title="Notes"
        >
          <StickyNote className="size-3.5" />
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenTerminal}
          className="chrome-icon-button flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground"
          aria-label="Open terminal"
          title="Terminal"
        >
          <Terminal className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
