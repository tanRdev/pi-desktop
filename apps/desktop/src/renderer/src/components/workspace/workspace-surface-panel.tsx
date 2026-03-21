import type { CanvasWindow } from "@pidesk/shared";
import {
  Activity,
  FileCode2,
  GitBranch,
  MonitorSmartphone,
  NotebookPen,
  X,
} from "lucide-react";
import type * as React from "react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { workspaceSessionStore } from "../../hooks/use-window-store";
import {
  selectFileWindowStateByWorktree,
  selectNoteWindowStateByWorktree,
} from "../../stores/workspace-session-selectors";
import { FileWindowContent } from "../canvas/file-window-content";
import { NoteWindowContent } from "../canvas/note-window-content";
import { Terminal } from "../ui/terminal";

type SurfaceWindow = Extract<
  CanvasWindow,
  { kind: "file" | "note" | "terminal" | "git" }
>;

function getSurfaceLabel(window: SurfaceWindow) {
  switch (window.kind) {
    case "file":
      return window.title;
    case "note":
      return window.title || "Notes";
    case "terminal":
      return window.title || "Terminal";
    case "git":
      return window.title || "Git";
  }
}

function getSurfaceIcon(window: SurfaceWindow) {
  switch (window.kind) {
    case "file":
      return FileCode2;
    case "note":
      return NotebookPen;
    case "terminal":
      return MonitorSmartphone;
    case "git":
      return GitBranch;
  }
}

export interface WorkspaceSurfacePanelProps {
  activeWorktreeId: string | null;
  selectedSurfaceKey: string;
  windows: SurfaceWindow[];
  onSelectActivity: () => void;
  onSelectWindow: (windowId: string) => void;
  onCloseWindow: (windowId: string) => void;
  onOpenFileTree: () => void;
  onOpenNote: () => void;
  onOpenTerminal: () => void;
  onOpenGit: () => void;
  onFileContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void | Promise<void>;
  onNoteContentChange: (windowId: string, content: string) => void;
  onNoteSave: (windowId: string, storagePath?: string) => void | Promise<void>;
  activityContent: React.ReactNode;
  className?: string;
}

export function WorkspaceSurfacePanel({
  activeWorktreeId,
  selectedSurfaceKey,
  windows,
  onSelectActivity,
  onSelectWindow,
  onCloseWindow,
  onOpenFileTree,
  onOpenNote,
  onOpenTerminal,
  onOpenGit,
  onFileContentChange,
  onFileSave,
  onNoteContentChange,
  onNoteSave,
  activityContent,
  className,
}: WorkspaceSurfacePanelProps) {
  const selectedWindow =
    windows.find((window) => window.id === selectedSurfaceKey) ?? null;
  const fileData = useStore(workspaceSessionStore, (storeState) =>
    selectedWindow?.kind === "file"
      ? selectFileWindowStateByWorktree(
          storeState,
          activeWorktreeId,
          selectedWindow.id,
        )
      : undefined,
  );
  const noteData = useStore(workspaceSessionStore, (storeState) =>
    selectedWindow?.kind === "note"
      ? selectNoteWindowStateByWorktree(
          storeState,
          activeWorktreeId,
          selectedWindow.id,
        )
      : undefined,
  );

  const renderSelectedContent = () => {
    if (!selectedWindow) {
      return activityContent;
    }

    if (selectedWindow.kind === "file") {
      return (
        <FileWindowContent
          filePath={selectedWindow.filePath}
          content={fileData?.content ?? null}
          isLoading={fileData?.isLoading}
          error={fileData?.error}
          isDirty={selectedWindow.isDirty}
          isReadOnly={selectedWindow.isReadOnly}
          onContentChange={(content) =>
            onFileContentChange(selectedWindow.id, content)
          }
          onSave={() => onFileSave(selectedWindow.id, selectedWindow.filePath)}
          className="h-full"
        />
      );
    }

    if (selectedWindow.kind === "note") {
      return (
        <NoteWindowContent
          content={noteData?.content ?? ""}
          onContentChange={(content) =>
            onNoteContentChange(selectedWindow.id, content)
          }
          onSave={() =>
            onNoteSave(selectedWindow.id, selectedWindow.storagePath)
          }
          className="h-full"
        />
      );
    }

    if (selectedWindow.kind === "terminal") {
      return (
        <Terminal
          id={selectedWindow.terminalId}
          cwd={selectedWindow.cwd}
          backend={selectedWindow.backend}
          ownerWindowId={selectedWindow.id}
          className="h-full"
        />
      );
    }

    if (selectedWindow.kind === "git") {
      return (
        <Terminal
          id={selectedWindow.terminalId}
          cwd={selectedWindow.repositoryPath}
          backend="lazygit"
          ownerWindowId={selectedWindow.id}
          className="h-full"
        />
      );
    }

    return activityContent;
  };

  return (
    <aside
      data-testid="workspace-context-panel"
      className={cn(
        "flex min-h-0 w-[min(32rem,38vw)] min-w-[22rem] max-w-[36rem] shrink-0 flex-col border-l border-[#474747]/20 bg-[#0b0b0b]",
        className,
      )}
    >
      <div className="border-b border-[#474747]/18 px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6f6f6f]">
            Context surfaces
          </p>
          <div className="flex items-center gap-1">
            {[
              { label: "Files", onClick: onOpenFileTree },
              { label: "Notes", onClick: onOpenNote },
              { label: "Terminal", onClick: onOpenTerminal },
              { label: "Git", onClick: onOpenGit },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="border border-[#474747]/20 bg-[#111111] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8a8a8a] transition-colors hover:border-white/40 hover:text-white"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={onSelectActivity}
            className={cn(
              "flex shrink-0 items-center gap-2 border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
              selectedWindow === null
                ? "border-white/50 bg-white text-black"
                : "border-[#474747]/20 bg-[#111111] text-[#8a8a8a] hover:text-white",
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            Activity
          </button>

          {windows.map((window) => {
            const Icon = getSurfaceIcon(window);
            const isSelected = selectedWindow?.id === window.id;

            return (
              <div key={window.id} className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onSelectWindow(window.id)}
                  className={cn(
                    "flex items-center gap-2 border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    isSelected
                      ? "border-white/50 bg-white text-black"
                      : "border-[#474747]/20 bg-[#111111] text-[#8a8a8a] hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="max-w-[10rem] truncate">
                    {getSurfaceLabel(window)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onCloseWindow(window.id)}
                  className="border border-l-0 border-[#474747]/20 bg-[#111111] px-1.5 py-1.5 text-[#666] transition-colors hover:text-white"
                  aria-label={`Close ${getSurfaceLabel(window)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {selectedWindow === null && windows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6f6f6f]">
                Context panel
              </p>
              <h3 className="text-base text-white">
                Open a supporting surface
              </h3>
              <p className="text-sm leading-6 text-[#8f8f8f]">
                Files, notes, terminal, and git now live beside chat instead of
                floating on a canvas.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { label: "Browse files", onClick: onOpenFileTree },
                { label: "Open notes", onClick: onOpenNote },
                { label: "Open terminal", onClick: onOpenTerminal },
                { label: "Open git", onClick: onOpenGit },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="border border-[#474747]/20 bg-[#111111] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a] transition-colors hover:border-white/40 hover:text-white"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          renderSelectedContent()
        )}
      </div>
    </aside>
  );
}
