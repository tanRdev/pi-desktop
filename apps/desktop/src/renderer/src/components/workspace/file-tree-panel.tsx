import type { FileEntry } from "@pi-desktop/shared/models/fs";
import { Skeleton } from "boneyard-js/react";
import { useCallback, useState } from "react";
import { ArrowClockwise } from "@/components/ui/icons";
import { useFileTree } from "@/hooks/use-file-tree";
import { cn } from "@/lib/utils";
import { FileTreeContextMenu } from "./file-tree-context-menu";
import { FileTreeItem } from "./file-tree-item";

interface FileTreePanelProps {
  workspacePath: string | null;
  onFileSelect: (path: string) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (oldPath: string, newPath: string) => void;
  onMoveFile?: (sourcePath: string, destinationPath: string) => void;
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
}: FileTreePanelProps) {
  const { rootNodes, isRootLoading, expandedPaths, toggleExpand, refreshRoot } =
    useFileTree(workspacePath);

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

  return (
    <div className="flex h-full flex-col select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.03]">
        <span className="text-[10.5px] text-white/50 font-medium tracking-wide uppercase">
          Files
        </span>
        <button
          type="button"
          onClick={refreshRoot}
          className={cn(
            "p-1 text-white/30 hover:text-white/60",
            "transition-colors duration-100",
          )}
        >
          <ArrowClockwise className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Skeleton
          name="file-tree"
          loading={isRootLoading}
          fixture={<FileTreeSkeleton />}
        >
          {rootNodes.length === 0 ? (
            <div className="px-3 py-6 text-center text-[10.5px] text-white/30">
              No files
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
                  isRenaming={renamingPath === node.entry.path}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={handleRenameCancel}
                  onContextMenu={handleContextMenu}
                  renamingPath={renamingPath}
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
          onRename={handleRename}
          onDelete={handleDelete}
          onMove={handleMove}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
