import type { FileEntry } from "@pi-desktop/shared/models/fs";
import * as React from "react";
import {
  CaretRight,
  CircleNotch,
  Folder,
  FolderOpen,
} from "@/components/ui/icons";
import type { FileTreeNode } from "@/hooks/use-file-tree";
import { type FileIcon, getFileIconByExtension } from "@/lib/file-icons";
import { cn } from "@/lib/utils";

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  childNodes: FileTreeNode[] | null;
  onToggleExpand: (path: string) => void;
  onFileSelect: (path: string) => void;
  expandedPaths: Set<string>;
  isActive?: boolean;
  isRenaming?: boolean;
  onRenameSubmit?: (oldPath: string, newName: string) => void;
  onRenameCancel?: () => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
  renamingPath?: string | null;
}

function getFileIcon(entry: FileEntry): FileIcon | null {
  if (entry.type === "directory") return null;
  return getFileIconByExtension(entry.name, entry.extension ?? null);
}

interface RenameInputProps {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

function RenameInput({ initialValue, onSubmit, onCancel }: RenameInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Select the basename (without extension) to match common editor UX.
    const dotIndex = initialValue.lastIndexOf(".");
    const selectionEnd = dotIndex > 0 ? dotIndex : initialValue.length;
    input.setSelectionRange(0, selectionEnd);
  }, [initialValue]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={initialValue}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSubmit(e.currentTarget.value);
        }
        if (e.key === "Escape") {
          onCancel();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className="bg-white/[0.06] border border-white/[0.12] px-1 py-0 text-[10.5px] text-white/80 outline-none w-full min-w-0"
    />
  );
}

export const FileTreeItem = React.memo(function FileTreeItem({
  entry,
  depth,
  isExpanded,
  isLoading,
  childNodes,
  onToggleExpand,
  onFileSelect,
  expandedPaths,
  isActive,
  isRenaming,
  onRenameSubmit,
  onRenameCancel,
  onContextMenu,
  renamingPath,
}: FileTreeItemProps) {
  const isDir = entry.type === "directory";
  const fileIcon = isDir ? null : getFileIcon(entry);
  const DirIcon = isDir ? (isExpanded ? FolderOpen : Folder) : null;

  function handleClick() {
    if (isDir) {
      onToggleExpand(entry.path);
    } else {
      onFileSelect(entry.path);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e, entry);
        }}
        className={cn(
          "flex h-7 w-full items-center gap-1.5 select-none",
          "text-[10.5px] text-white/50 hover:text-white/80",
          "hover:bg-white/[0.04]",
          "transition-colors duration-100",
          isActive && "bg-white/[0.06]",
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {isDir ? (
          isLoading ? (
            <CircleNotch className="w-3 h-3 text-white/30 animate-spin" />
          ) : (
            <CaretRight
              className={cn(
                "w-3 h-3 text-white/30 transition-transform duration-150",
                isExpanded && "rotate-90",
              )}
            />
          )
        ) : (
          <span className="w-3 h-3" />
        )}
        {IconComponent && (
          <IconComponent className="w-3.5 h-3.5 text-white/40 shrink-0" />
        )}
        {isRenaming ? (
          <RenameInput
            initialValue={entry.name}
            onSubmit={(value) => onRenameSubmit?.(entry.path, value)}
            onCancel={() => onRenameCancel?.()}
          />
        ) : (
          <span className="truncate">{entry.name}</span>
        )}
      </button>
      {isDir &&
        isExpanded &&
        childNodes?.map((child) => (
          <FileTreeItem
            key={child.entry.path}
            entry={child.entry}
            depth={depth + 1}
            isExpanded={expandedPaths.has(child.entry.path)}
            isLoading={child.isLoading}
            childNodes={child.children}
            onToggleExpand={onToggleExpand}
            onFileSelect={onFileSelect}
            expandedPaths={expandedPaths}
            isRenaming={renamingPath === child.entry.path}
            onRenameSubmit={onRenameSubmit}
            onRenameCancel={onRenameCancel}
            onContextMenu={onContextMenu}
            renamingPath={renamingPath}
          />
        ))}
    </>
  );
});
