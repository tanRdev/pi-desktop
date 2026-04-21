import type { WorkspaceWindow } from "@pi-desktop/shared";
import * as React from "react";
import type { WindowStoreAdapter } from "@/hooks/use-window-store";
import { toast } from "@/lib/toast";
import {
  openFileWindowForWorktree,
  saveFileWindowForWorktree,
  updateFileDraftForWorktree,
} from "@/stores/workspace-session-runtime";
import type { WorkspaceSessionStore } from "@/stores/workspace-session-store";
import type { ContextSurfaceKey, ContextWindow } from "./workspace-pane-state";

function getErrorDescription(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getInitialContextSurface(
  windows: ContextWindow[],
  current: ContextSurfaceKey | null,
): ContextSurfaceKey | null {
  if (current === null || current === "activity") {
    return current;
  }

  if (windows.some((window) => window.id === current)) {
    return current;
  }

  return null;
}

export interface WorkspaceWindowsController {
  contextWindows: ContextWindow[];
  selectedContextSurface: ContextSurfaceKey | null;
  isTerminalVisible: boolean;
  clearSelectedContextSurface: () => void;
  handleSelectContextSurface: (surfaceKey: ContextSurfaceKey | null) => void;
  handleCloseFileWindow: (windowId: string) => void;
  handleToggleTerminal: () => void;
  handleOpenGit: () => void;
  handleFileContentChange: (windowId: string, newContent: string) => void;
  handleFileSave: (windowId: string, filePath: string) => Promise<void>;
  handleFileTreeFileSelect: (filePath: string) => Promise<void>;
  handleFileTreeDeleteFile: (path: string) => Promise<void>;
  handleFileTreeRenameFile: (oldPath: string, newPath: string) => Promise<void>;
  handleFileTreeMoveFile: (
    source: string,
    destination: string,
  ) => Promise<void>;
}

export interface UseWorkspaceWindowsOptions {
  activeRepositoryName: string | null;
  activeWorktreeId: string | null;
  activeWorktreePath: string | null;
  windows: WorkspaceWindow[];
  sessionStore: WorkspaceSessionStore;
  windowStore: Pick<
    WindowStoreAdapter,
    "createWindow" | "closeWindow" | "focusWindow" | "updateWindow" | "setDirty"
  >;
}

export function useWorkspaceWindows({
  activeRepositoryName,
  activeWorktreeId,
  activeWorktreePath,
  windows,
  sessionStore,
  windowStore,
}: UseWorkspaceWindowsOptions): WorkspaceWindowsController {
  const contextWindows = React.useMemo(
    () =>
      windows.filter(
        (window): window is ContextWindow =>
          window.kind === "file" ||
          window.kind === "terminal" ||
          window.kind === "git",
      ),
    [windows],
  );
  const [selectedContextSurface, setSelectedContextSurface] =
    React.useState<ContextSurfaceKey | null>(null);
  const [isTerminalVisible, setIsTerminalVisible] = React.useState(false);

  const clearSelectedContextSurface = React.useCallback(() => {
    setSelectedContextSurface(null);
  }, []);

  React.useEffect(() => {
    const noteWindows = windows.filter((window) => window.kind === "note");

    if (noteWindows.length === 0) {
      return;
    }

    noteWindows.forEach((window) => {
      windowStore.closeWindow(window.id);
    });
  }, [windows, windowStore]);

  React.useEffect(() => {
    setSelectedContextSurface((current) =>
      getInitialContextSurface(contextWindows, current),
    );
  }, [contextWindows]);

  const handleSelectContextSurface = React.useCallback(
    (surfaceKey: ContextSurfaceKey | null) => {
      if (surfaceKey === selectedContextSurface) {
        setSelectedContextSurface(null);
        return;
      }

      setSelectedContextSurface(surfaceKey);
      if (surfaceKey && surfaceKey !== "activity") {
        windowStore.focusWindow(surfaceKey);
      }
    },
    [selectedContextSurface, windowStore],
  );

  const handleCloseFileWindow = React.useCallback(
    (windowId: string) => {
      const fileWindows = contextWindows.filter(
        (window): window is Extract<ContextWindow, { kind: "file" }> =>
          window.kind === "file",
      );
      const closingIndex = fileWindows.findIndex(
        (window) => window.id === windowId,
      );
      const nextFileWindow =
        closingIndex >= 0
          ? (fileWindows[closingIndex + 1] ??
            fileWindows[closingIndex - 1] ??
            null)
          : null;

      windowStore.closeWindow(windowId);

      if (selectedContextSurface !== windowId) {
        return;
      }

      setSelectedContextSurface(nextFileWindow?.id ?? null);
    },
    [contextWindows, selectedContextSurface, windowStore],
  );

  const handleToggleTerminal = React.useCallback(() => {
    setIsTerminalVisible((current) => !current);
  }, []);

  const handleOpenGit = React.useCallback(() => {
    if (!activeWorktreePath) {
      return;
    }

    const existingGitWindow = windows.find(
      (window): window is Extract<WorkspaceWindow, { kind: "git" }> =>
        window.kind === "git" && window.repositoryPath === activeWorktreePath,
    );
    if (existingGitWindow) {
      if (existingGitWindow.id === selectedContextSurface) {
        setSelectedContextSurface(null);
        return;
      }

      windowStore.focusWindow(existingGitWindow.id);
      setSelectedContextSurface(existingGitWindow.id);
      return;
    }

    const gitWindow = windowStore.createWindow(
      { kind: "git", repositoryPath: activeWorktreePath },
      activeWorktreePath,
    );
    windowStore.updateWindow(gitWindow.id, {
      title: `Git · ${activeRepositoryName ?? "Repository"}`,
    });
    setSelectedContextSurface(gitWindow.id);
  }, [
    activeRepositoryName,
    activeWorktreePath,
    selectedContextSurface,
    windowStore,
    windows,
  ]);

  const handleFileContentChange = React.useCallback(
    (windowId: string, newContent: string) => {
      updateFileDraftForWorktree({
        sessionStore,
        worktreeId: activeWorktreeId,
        windowId,
        content: newContent,
      });
      windowStore.setDirty(windowId, true);
    },
    [activeWorktreeId, sessionStore, windowStore],
  );

  const handleFileSave = React.useCallback(
    async (windowId: string, filePath: string) => {
      const didSave = await saveFileWindowForWorktree({
        sessionStore,
        worktreeId: activeWorktreeId,
        windowId,
        filePath,
        writeFile: (nextFilePath, content) =>
          window.piDesktop.fs.writeFile(nextFilePath, content),
      }).then(
        (result) => result,
        (error) => {
          toast.error("Failed to save file", {
            description: getErrorDescription(
              error,
              "The file could not be written to disk",
            ),
          });
          return false;
        },
      );

      if (didSave) {
        windowStore.setDirty(windowId, false);
      }
    },
    [activeWorktreeId, sessionStore, windowStore],
  );

  const handleFileTreeFileSelect = React.useCallback(
    async (filePath: string) => {
      if (!activeWorktreeId) {
        return;
      }

      const openedWindowId = await openFileWindowForWorktree({
        sessionStore,
        windowActions: {
          createWindow: windowStore.createWindow,
          focusWindow: windowStore.focusWindow,
        },
        windows,
        worktreeId: activeWorktreeId,
        worktreePath: activeWorktreePath,
        filePath,
        readFile: (nextFilePath) => window.piDesktop.fs.readFile(nextFilePath),
      });

      setSelectedContextSurface(openedWindowId);
    },
    [activeWorktreeId, activeWorktreePath, sessionStore, windowStore, windows],
  );

  const handleFileTreeDeleteFile = React.useCallback(async (path: string) => {
    await window.piDesktop.fs.deleteFile(path);
    toast.success("Deleted", { description: path.split("/").pop() });
  }, []);

  const handleFileTreeRenameFile = React.useCallback(
    async (oldPath: string, newPath: string) => {
      await window.piDesktop.fs.renameFile(oldPath, newPath);
      toast.success("Renamed", { description: newPath.split("/").pop() });
    },
    [],
  );

  const handleFileTreeMoveFile = React.useCallback(
    async (source: string, destination: string) => {
      await window.piDesktop.fs.moveFile(source, destination);
      toast.success("Moved", { description: source.split("/").pop() });
    },
    [],
  );

  return {
    contextWindows,
    selectedContextSurface,
    isTerminalVisible,
    clearSelectedContextSurface,
    handleSelectContextSurface,
    handleCloseFileWindow,
    handleToggleTerminal,
    handleOpenGit,
    handleFileContentChange,
    handleFileSave,
    handleFileTreeFileSelect,
    handleFileTreeDeleteFile,
    handleFileTreeRenameFile,
    handleFileTreeMoveFile,
  };
}
