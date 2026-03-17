import { FolderTree, GitBranch, StickyNote, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TitleBarProps {
  sidebarView: "files" | "git" | "notes" | null;
  setSidebarView: (view: "files" | "git" | "notes" | null) => void;
  hasOpenNotes: boolean;
  onOpenLauncher: () => void;
  onOpenNote: () => void;
  onOpenGit: () => void;
  onOpenTerminal: () => void;
}

export function TitleBar({
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
      className="titlebar relative flex h-10 shrink-0 items-center justify-between bg-surface-1 px-3"
    >
      <div className="w-16" />
      <button
        type="button"
        data-no-drag="true"
        data-testid="app-title"
        onClick={onOpenLauncher}
        className="rounded px-2 py-1 text-lg font-semibold tracking-tight text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
        title="Pi launcher"
      >
        π
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-no-drag="true"
          onClick={() =>
            setSidebarView(sidebarView === "files" ? null : "files")
          }
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition",
            sidebarView === "files"
              ? "bg-surface-3 text-foreground"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          )}
          title="Files"
        >
          <FolderTree className="size-3.5" />
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenGit}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          title="Git"
        >
          <GitBranch className="size-3.5" />
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenNote}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition",
            hasOpenNotes
              ? "bg-surface-3 text-foreground"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          )}
          title="Notes"
        >
          <StickyNote className="size-3.5" />
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenTerminal}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          title="Terminal"
        >
          <Terminal className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
