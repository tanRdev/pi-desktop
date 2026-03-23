import type { WorkspaceWindow } from "@pidesk/shared";
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
import { Terminal } from "../ui/terminal";
import { WorkspaceFileContent } from "./workspace-file-content";
import { WorkspaceNoteContent } from "./workspace-note-content";

type SurfaceWindow = Extract<
  WorkspaceWindow,
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
  onOpenLauncher: () => void;
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
  onOpenLauncher,
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
        <WorkspaceFileContent
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
        <WorkspaceNoteContent
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
        "flex min-h-0 w-[min(28rem,30vw)] min-w-[18rem] max-w-[32rem] shrink-0 flex-col border-l border-[#474747]/20 bg-[#0b0b0b]",
        className,
      )}
    >
      <div className="border-b border-[#474747]/18 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div />
          <div className="flex items-center gap-1.5">
            {[
              {
                label: "Launcher",
                onClick: onOpenLauncher,
                testId: "sidecar-action-launcher",
              },
              {
                label: "Files",
                onClick: onOpenFileTree,
                testId: "sidecar-action-files",
              },
              {
                label: "Notes",
                onClick: onOpenNote,
                testId: "sidecar-action-notes",
              },
              {
                label: "Terminal",
                onClick: onOpenTerminal,
                testId: "sidecar-action-terminal",
              },
              {
                label: "Git",
                onClick: onOpenGit,
                testId: "sidecar-action-git",
              },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                data-testid={action.testId}
                className="border border-[#474747]/20 bg-[#111111] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#8a8a8a] transition-colors hover:border-white/40 hover:text-white"
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
              "flex shrink-0 items-center gap-2 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
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
                    "flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
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
          <div className="flex h-full items-center justify-center px-8">
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
                  className="border border-[#474747]/20 bg-[#111111] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#8a8a8a] transition-colors hover:border-white/40 hover:text-white"
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
