import { useStore } from "zustand";
import { getWorkspaceSessionStore } from "../../hooks/use-window-store";
import { selectFileWindowStateByWorktree } from "../../stores/workspace-session-selectors";
import { WorkspaceFileContent } from "./workspace-file-content";

export interface CenterFileViewerProps {
  activeWorktreeId: string | null;
  windowId: string;
  filePath: string;
  isDirty: boolean;
  isReadOnly?: boolean;
  onContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void | Promise<void>;
}

export function CenterFileViewer({
  activeWorktreeId,
  windowId,
  filePath,
  isDirty,
  isReadOnly,
  onContentChange,
  onFileSave,
}: CenterFileViewerProps) {
  const fileState = useStore(getWorkspaceSessionStore(), (storeState) =>
    selectFileWindowStateByWorktree(storeState, activeWorktreeId, windowId),
  );

  return (
    <WorkspaceFileContent
      filePath={filePath}
      content={fileState?.content ?? null}
      isLoading={fileState?.isLoading ?? false}
      error={fileState?.error ?? null}
      isDirty={isDirty}
      isReadOnly={isReadOnly}
      onContentChange={(content) => onContentChange(windowId, content)}
      onSave={() => void onFileSave(windowId, filePath)}
      className="h-full"
    />
  );
}
