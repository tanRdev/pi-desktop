import type { RepositorySnapshot } from "@pidesk/shared";
import { FolderTree, GitBranch, StickyNote, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TitleBarProps {
  activeRepository: RepositorySnapshot | null;
  activeWorktreeLabel: string | null;
  sidebarView: "files" | "git" | "notes" | null;
  setSidebarView: (view: "files" | "git" | "notes" | null) => void;
  hasOpenNotes: boolean;
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
      <div className="flex min-w-0 items-center gap-3 pl-[88px]">
        <button
          type="button"
          data-no-drag="true"
          data-testid="app-title"
          onClick={onOpenLauncher}
          className="chrome-icon-button rounded-md px-2 py-1 text-base font-semibold tracking-tight"
          aria-label="Open launcher"
          title="Pi launcher"
        >
          π
        </button>

        <div className="min-w-0" data-no-drag="true">
          <div className="chrome-eyebrow">Project</div>
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              data-testid="titlebar-project-name"
              className="truncate text-sm font-semibold text-foreground"
            >
              {activeRepository?.name ?? "No project selected"}
            </span>
            {activeWorktreeLabel ? (
              <span
                data-testid="titlebar-worktree-label"
                className="truncate text-xs text-muted-foreground"
              >
                {activeWorktreeLabel}
              </span>
            ) : null}
          </div>
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
