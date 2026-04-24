import type { FileEntry } from "@pi-desktop/shared/models/fs";
import type { GitFileChangeStatus } from "@pi-desktop/shared/models/git";
import * as React from "react";
import {
  CaretRight,
  CircleNotch,
  Folder,
  FolderOpen,
} from "@/components/ui/icons";
import type { FileTreeNode } from "@/features/workspace/use-file-tree";
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
  /** True when this row is part of a multi-selection (visual only). */
  isMultiSelected?: boolean;
  /** True when this row is the keyboard-focus cursor (single selected). */
  isSelected?: boolean;
  /** Multi-select paths to forward to descendants when rendering recursively. */
  multiSelectedPaths?: Set<string>;
  /** Single-selected cursor path, forwarded to descendants. */
  selectedPath?: string | null;
  /** Called when user Cmd/Ctrl+clicks this row. */
  onToggleMultiSelect?: (path: string) => void;
  isRenaming?: boolean;
  onRenameSubmit?: (oldPath: string, newName: string) => void;
  onRenameCancel?: () => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
  renamingPath?: string | null;
  /** Per-file git status (for this entry). */
  gitStatus?: GitFileChangeStatus | null;
  /** Map of absolute-path → git status, forwarded to rendered descendants. */
  gitStatusMap?: Map<string, GitFileChangeStatus> | null;
}

interface GitBadgeSpec {
  char: string;
  color: string;
}

function getGitBadge(status: GitFileChangeStatus): GitBadgeSpec | null {
  switch (status) {
    case "modified":
      return { char: "M", color: "var(--color-warning)" };
    case "added":
    case "untracked":
      return { char: "A", color: "var(--color-success)" };
    case "deleted":
      return { char: "D", color: "var(--color-error)" };
    case "renamed":
      return { char: "R", color: "var(--color-info)" };
    default:
      return null;
  }
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
      className="bg-white/[0.06] border border-white/[0.12] px-1 py-0 text-[11px] text-white/80 outline-none w-full min-w-0"
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
  isMultiSelected,
  isSelected,
  multiSelectedPaths,
  selectedPath,
  onToggleMultiSelect,
  isRenaming,
  onRenameSubmit,
  onRenameCancel,
  onContextMenu,
  renamingPath,
  gitStatus,
  gitStatusMap,
}: FileTreeItemProps) {
  const isDir = entry.type === "directory";
  const fileIcon = isDir ? null : getFileIcon(entry);
  const DirIcon = isDir ? (isExpanded ? FolderOpen : Folder) : null;
  const badge = gitStatus ? getGitBadge(gitStatus) : null;

  function handleClick(e: React.MouseEvent) {
    if ((e.metaKey || e.ctrlKey) && onToggleMultiSelect) {
      onToggleMultiSelect(entry.path);
      return;
    }
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
        role="treeitem"
        aria-label={entry.name}
        aria-expanded={isDir ? isExpanded : undefined}
        aria-selected={isSelected ? true : undefined}
        data-path={entry.path}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e, entry);
        }}
        className={cn(
          "flex h-7 w-full items-center gap-1.5 select-none",
          "text-[11px] text-white/50 hover:text-white/80",
          "hover:bg-white/[0.06]",
          "transition-colors duration-100",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
          isActive && "bg-white/[0.06]",
          isSelected && "bg-white/[0.07] text-white/80",
          isMultiSelected && "bg-white/[0.09] text-white/85",
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {isDir ? (
          isLoading ? (
            <CircleNotch className="w-3 h-3 text-white/50 animate-spin" />
          ) : (
            <CaretRight
              className={cn(
                "w-3 h-3 text-white/50 transition-transform duration-150",
                isExpanded && "rotate-90",
              )}
            />
          )
        ) : (
          <span className="w-3 h-3" />
        )}
        {DirIcon && <DirIcon className="w-3.5 h-3.5 text-white/40 shrink-0" />}
        {fileIcon && (
          <fileIcon.Icon
            className={cn("w-3.5 h-3.5 shrink-0", fileIcon.colorClassName)}
          />
        )}
        {isRenaming ? (
          <RenameInput
            initialValue={entry.name}
            onSubmit={(value) => onRenameSubmit?.(entry.path, value)}
            onCancel={() => onRenameCancel?.()}
          />
        ) : (
          <>
            <span
              className="truncate"
              style={badge ? { color: badge.color, opacity: 0.9 } : undefined}
            >
              {entry.name}
            </span>
            {badge && (
              <span
                title={`git ${gitStatus}`}
                data-testid="git-status-badge"
                className="ml-auto shrink-0 pr-1 text-[9.5px] font-mono font-medium select-none"
                style={{ color: badge.color, opacity: 0.75 }}
              >
                {badge.char}
              </span>
            )}
          </>
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
            isSelected={selectedPath === child.entry.path}
            isMultiSelected={multiSelectedPaths?.has(child.entry.path)}
            multiSelectedPaths={multiSelectedPaths}
            selectedPath={selectedPath}
            onToggleMultiSelect={onToggleMultiSelect}
            isRenaming={renamingPath === child.entry.path}
            onRenameSubmit={onRenameSubmit}
            onRenameCancel={onRenameCancel}
            onContextMenu={onContextMenu}
            renamingPath={renamingPath}
            gitStatus={gitStatusMap?.get(child.entry.path) ?? null}
            gitStatusMap={gitStatusMap}
          />
        ))}
    </>
  );
});
