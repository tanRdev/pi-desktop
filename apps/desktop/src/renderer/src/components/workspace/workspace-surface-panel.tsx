import type { WorkspaceWindow } from "@pi-desktop/shared";
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

interface WorkspaceSurfaceContentProps {
  selectedWindow: SurfaceWindow | null;
  fileData: ReturnType<typeof selectFileWindowStateByWorktree> | undefined;
  activityContent: React.ReactNode;
  onFileContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void | Promise<void>;
}

function WorkspaceSurfaceContent({
  selectedWindow,
  fileData,
  activityContent,
  onFileContentChange,
  onFileSave,
}: WorkspaceSurfaceContentProps) {
  if (!selectedWindow || selectedWindow.kind === "git") {
    return activityContent;
  }

  switch (selectedWindow.kind) {
    case "file":
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
    case "terminal":
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

  return (
    <section
      data-testid="workspace-context-panel"
      className={cn("flex min-h-0 flex-1 flex-col bg-transparent", className)}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <WorkspaceSurfaceContent
          selectedWindow={selectedWindow}
          fileData={fileData}
          activityContent={activityContent}
          onFileContentChange={onFileContentChange}
          onFileSave={onFileSave}
        />
      </div>
    </section>
  );
}
