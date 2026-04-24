import type { FileEntry } from "@pi-desktop/shared/models/fs";
import type {
  GitFileChangeStatus,
  GitRepositoryStatus,
} from "@pi-desktop/shared/models/git";
import { Skeleton } from "boneyard-js/react";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowClockwise,
  ClockCounterClockwise,
  FolderPlus,
  MagnifyingGlass,
  Plus,
  PushPin,
} from "@/components/ui/icons";
import { useRecentFiles } from "@/features/workspace/recent-items";
import { useFileTree } from "@/features/workspace/use-file-tree";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { FileTreeContextMenu } from "./file-tree-context-menu";
import { FileTreeItem } from "./file-tree-item";

interface FileTreePanelProps {
  workspacePath: string | null;
  onFileSelect: (path: string) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (oldPath: string, newPath: string) => void;
  onMoveFile?: (sourcePath: string, destinationPath: string) => void;
  repositoryStatus?: GitRepositoryStatus | null;
}

function buildGitStatusMap(
  repositoryStatus: GitRepositoryStatus | null | undefined,
  workspacePath: string | null,
): Map<string, GitFileChangeStatus> | null {
  if (!repositoryStatus || !workspacePath) return null;
  const root = repositoryStatus.repositoryPath || workspacePath;
  const map = new Map<string, GitFileChangeStatus>();
  // Unstaged takes precedence over staged for the displayed state; merge both.
  const all = [
    ...repositoryStatus.stagedChanges,
    ...repositoryStatus.unstagedChanges,
  ];
  for (const change of all) {
    const absolutePath = `${root}/${change.path}`;
    // Unstaged should win if both exist — iterate staged first, then unstaged overwrites.
    map.set(absolutePath, change.status);
  }
  return map.size > 0 ? map : null;
}

function FileTreeSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="h-5 bg-white/5"
          style={{
            width: `${60 + Math.random() * 30}%`,
            marginLeft: i > 2 && i < 6 ? 16 : 0,
          }}
        />
      ))}
    </div>
  );
}

export function FileTreePanel({
  workspacePath,
  onFileSelect,
  onDeleteFile,
  onRenameFile,
  onMoveFile,
  repositoryStatus,
}: FileTreePanelProps) {
  const {
    rootNodes,
    isRootLoading,
    expandedPaths,
    toggleExpand,
    refreshRoot,
    filter,
    setFilter,
    selectedPath,
    multiSelectedPaths,
    toggleMultiSelect,
    handleKeyDown: handleTreeKeyDown,
    flatRows,
  } = useFileTree(workspacePath);

  const recentFiles = useRecentFiles();
  const recentFileItems = useMemo(
    () =>
      [...recentFiles.items.pinned, ...recentFiles.items.recent].slice(0, 5),
    [recentFiles.items.pinned, recentFiles.items.recent],
  );
  const hasRecentFiles = recentFileItems.length > 0 && filter.length === 0;

  const gitStatusMap = useMemo(
    () => buildGitStatusMap(repositoryStatus ?? null, workspacePath),
    [repositoryStatus, workspacePath],
  );

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    name: string;
    isDirectory: boolean;
  } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: FileEntry) => {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        path: entry.path,
        name: entry.name,
        isDirectory: entry.type === "directory",
      });
    },
    [],
  );

  function handleRename(path: string) {
    setRenamingPath(path);
    setContextMenu(null);
  }

  const handleRenameSubmit = useCallback(
    (oldPath: string, newName: string) => {
      const lastSlash = oldPath.lastIndexOf("/");
      const parentDir = lastSlash >= 0 ? oldPath.substring(0, lastSlash) : "";
      const newPath = parentDir ? `${parentDir}/${newName}` : newName;
      onRenameFile?.(oldPath, newPath);
      setRenamingPath(null);
    },
    [onRenameFile],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
  }, []);

  function handleDelete(path: string) {
    onDeleteFile?.(path);
    setContextMenu(null);
  }

  function handleMove(path: string) {
    onMoveFile?.(path, "");
    setContextMenu(null);
  }

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" && selectedPath) {
        const row = flatRows.find((r) => r.entry.path === selectedPath);
        if (row && row.entry.type === "file") {
          e.preventDefault();
          onFileSelect(selectedPath);
          return;
        }
        if (row && row.entry.type === "directory") {
          e.preventDefault();
          void toggleExpand(selectedPath);
          return;
        }
      }
      handleTreeKeyDown({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        preventDefault: () => e.preventDefault(),
      });
    },
    [flatRows, handleTreeKeyDown, onFileSelect, selectedPath, toggleExpand],
  );

  const handleNewFile = useCallback(() => {
    toast.info("New file not yet wired", {
      description: "IPC channel for creating files is not implemented yet.",
    });
  }, []);

  const handleNewFolder = useCallback(() => {
    toast.info("New folder not yet wired", {
      description:
        "IPC channel for creating directories is not implemented yet.",
    });
  }, []);

  return (
    <div className="flex h-full flex-col select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[11px] text-white/50 font-medium tracking-wide uppercase">
          Files
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleNewFile}
            aria-label="New file"
            title="New file"
            className={cn(
              "p-1 text-white/50 hover:text-white/60",
              "transition-colors duration-100",
            )}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNewFolder}
            aria-label="New folder"
            title="New folder"
            className={cn(
              "p-1 text-white/50 hover:text-white/60",
              "transition-colors duration-100",
            )}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={refreshRoot}
            aria-label="Refresh"
            title="Refresh"
            className={cn(
              "p-1 text-white/50 hover:text-white/60",
              "transition-colors duration-100",
            )}
          >
            <ArrowClockwise className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-2 py-1.5 border-b border-white/[0.06]">
        <div className="relative flex items-center">
          <MagnifyingGlass className="absolute left-2 w-3 h-3 text-white/50 pointer-events-none" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files..."
            aria-label="Filter files"
            className={cn(
              "w-full bg-white/[0.06] border border-white/[0.04] pl-7 pr-2 py-1",
              "text-[11px] text-white/70 placeholder:text-white/50",
              "focus:outline-none focus:border-white/[0.12] focus:bg-white/[0.05]",
              "transition-colors duration-100",
            )}
          />
        </div>
      </div>

      <div
        role="tree"
        aria-label="File tree"
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        className="flex-1 overflow-y-auto focus:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
      >
        <Skeleton
          name="file-tree"
          loading={isRootLoading}
          fixture={<FileTreeSkeleton />}
        >
          {hasRecentFiles && (
            <div className="border-b border-white/[0.06]">
              <div className="flex items-center gap-1.5 px-3 py-1">
                <ClockCounterClockwise className="w-3 h-3 text-white/50" />
                <span className="text-[9.5px] text-white/50 font-medium tracking-wide uppercase">
                  Recent
                </span>
              </div>
              {recentFileItems.map((item) => {
                const isPinned = recentFiles.items.pinned.some(
                  (p) => p.id === item.id,
                );
                const name = item.label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if ("path" in item && typeof item.path === "string") {
                        onFileSelect(item.path);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 w-full px-3 h-6",
                      "text-[11px] text-white/50 hover:text-white/80 truncate",
                      "hover:bg-white/[0.06] transition-colors duration-100",
                    )}
                  >
                    {isPinned && (
                      <PushPin
                        className="w-2.5 h-2.5 text-white/50 shrink-0"
                        weight="fill"
                      />
                    )}
                    <span className="truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {rootNodes.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-white/50">
              No files
            </div>
          ) : filter.length > 0 ? (
            <div className="py-1">
              {flatRows.map((row) => (
                <FileTreeItem
                  key={row.entry.path}
                  entry={row.entry}
                  depth={row.depth}
                  isExpanded={row.isExpanded}
                  isLoading={false}
                  childNodes={null}
                  onToggleExpand={toggleExpand}
                  onFileSelect={onFileSelect}
                  expandedPaths={expandedPaths}
                  isSelected={selectedPath === row.entry.path}
                  isMultiSelected={multiSelectedPaths.has(row.entry.path)}
                  multiSelectedPaths={multiSelectedPaths}
                  selectedPath={selectedPath}
                  onToggleMultiSelect={toggleMultiSelect}
                  isRenaming={renamingPath === row.entry.path}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={handleRenameCancel}
                  onContextMenu={handleContextMenu}
                  renamingPath={renamingPath}
                  gitStatus={gitStatusMap?.get(row.entry.path) ?? null}
                  gitStatusMap={gitStatusMap}
                />
              ))}
              {flatRows.length === 0 && (
                <div className="px-3 py-6 text-center text-[11px] text-white/50">
                  No matches
                </div>
              )}
            </div>
          ) : (
            <div className="py-1">
              {rootNodes.map((node) => (
                <FileTreeItem
                  key={node.entry.path}
                  entry={node.entry}
                  depth={0}
                  isExpanded={expandedPaths.has(node.entry.path)}
                  isLoading={node.isLoading}
                  childNodes={node.children}
                  onToggleExpand={toggleExpand}
                  onFileSelect={onFileSelect}
                  expandedPaths={expandedPaths}
                  isSelected={selectedPath === node.entry.path}
                  isMultiSelected={multiSelectedPaths.has(node.entry.path)}
                  multiSelectedPaths={multiSelectedPaths}
                  selectedPath={selectedPath}
                  onToggleMultiSelect={toggleMultiSelect}
                  isRenaming={renamingPath === node.entry.path}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={handleRenameCancel}
                  onContextMenu={handleContextMenu}
                  renamingPath={renamingPath}
                  gitStatus={gitStatusMap?.get(node.entry.path) ?? null}
                  gitStatusMap={gitStatusMap}
                />
              ))}
            </div>
          )}
        </Skeleton>
      </div>
      {contextMenu && (
        <FileTreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          filePath={contextMenu.path}
          fileName={contextMenu.name}
          isDirectory={contextMenu.isDirectory}
          workspacePath={workspacePath}
          onRename={handleRename}
          onDelete={handleDelete}
          onMove={handleMove}
          onClose={() => setContextMenu(null)}
          isPinned={recentFiles.items.pinned.some(
            (p) => p.id === contextMenu.path,
          )}
          onPin={(path) => {
            recentFiles.add({
              id: path,
              label: path.split("/").pop() ?? path,
              path,
              accessedAt: Date.now(),
            });
            recentFiles.pin(path);
          }}
          onUnpin={(path) => {
            recentFiles.unpin(path);
          }}
        />
      )}
    </div>
  );
}
