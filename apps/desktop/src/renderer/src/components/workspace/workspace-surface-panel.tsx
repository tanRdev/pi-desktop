import type { WorkspaceWindow } from "@pidesk/shared";
import type * as React from "react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { workspaceSessionStore } from "../../hooks/use-window-store";
import { selectFileWindowStateByWorktree } from "../../stores/workspace-session-selectors";
import { Terminal } from "../ui/terminal";
import { WorkspaceFileContent } from "./workspace-file-content";

type SurfaceWindow = Extract<
  WorkspaceWindow,
  { kind: "file" | "terminal" | "git" }
>;

export interface WorkspaceSurfacePanelProps {
  activeWorktreeId: string | null;
  selectedSurfaceKey: string;
  windows: SurfaceWindow[];
  onFileContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void | Promise<void>;
  activityContent: React.ReactNode;
  className?: string;
}

export function WorkspaceSurfacePanel({
  activeWorktreeId,
  selectedSurfaceKey,
  windows,
  onFileContentChange,
  onFileSave,
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
    <section
      data-testid="workspace-context-panel"
      className={cn("flex min-h-0 flex-1 flex-col bg-[#0b0b0b]", className)}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        {renderSelectedContent()}
      </div>
    </section>
  );
}
