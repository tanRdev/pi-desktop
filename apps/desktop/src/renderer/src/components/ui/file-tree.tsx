import type { DirectoryListing, FileEntry } from "@pidesk/shared";
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Image,
  FileWarning,
  Box,
  Database,
  GitBranch,
  Layers,
  Terminal,
  Settings,
  Pencil,
  RefreshCw,
} from "@/components/ui/icons";
import * as React from "react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  rootPath: string | null | undefined;
  onFileClick?: (path: string) => void;
  className?: string;
}

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  onToggle: (path: string) => void;
  onFileClick?: (path: string) => void;
  expandedPaths: Set<string>;
  loadDirectory: (path: string) => Promise<DirectoryListing | null>;
  cache: Map<string, DirectoryListing>;
  selectedPath?: string | null;
}

// File extension to icon mapping
const getFileIcon = (filename: string, isSelected: boolean) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const className = cn(
    "size-4 shrink-0 transition-all duration-200",
    isSelected ? "text-primary" : "text-muted-foreground/70",
  );

  switch (ext) {
    // Code files
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
    case "json":
    case "css":
    case "scss":
    case "html":
    case "xml":
    case "yaml":
    case "yml":
    case "py":
    case "rb":
    case "go":
    case "rs":
    case "cpp":
    case "c":
    case "java":
    case "php":
    case "swift":
    case "kt":
      return <FileCode className={className} />;
    // Images
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
      return <Image className={className} />;
    // Config/Dotfiles
    case "env":
    case "config":
    case "ini":
    case "toml":
      return <Settings className={className} />;
    // Documentation
    case "md":
    case "mdx":
    case "txt":
    case "doc":
    case "docx":
    case "pdf":
      return <FileText className={className} />;
    // Database
    case "sql":
    case "db":
    case "sqlite":
      return <Database className={className} />;
    // Package
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return <Box className={className} />;
    // Git
    case "gitignore":
    case "gitattributes":
      return <GitBranch className={className} />;
    // Shell/Terminal
    case "sh":
    case "bash":
    case "zsh":
    case "fish":
      return <Terminal className={className} />;
    default:
      return <File className={className} />;
  }
};

// Get folder color based on name
const getFolderIcon = (isExpanded: boolean, isSelected: boolean) => {
  const className = cn(
    "size-4 shrink-0 transition-all duration-200",
    isSelected
      ? "text-primary"
      : isExpanded
        ? "text-amber-400/90"
        : "text-amber-400/70",
  );

  return isExpanded ? (
    <FolderOpen className={className} />
  ) : (
    <Folder className={className} />
  );
};

function FileTreeItem({
  entry,
  depth,
  onToggle,
  onFileClick,
  expandedPaths,
  loadDirectory,
  cache,
  selectedPath,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(entry.path);
  const isDirectory = entry.type === "directory";
  const isSelected = selectedPath === entry.path;
  const [children, setChildren] = React.useState<DirectoryListing | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = React.useCallback(() => {
    if (isDirectory) {
      onToggle(entry.path);
    } else {
      onFileClick?.(entry.path);
    }
  }, [isDirectory, onToggle, onFileClick, entry.path]);

  React.useEffect(() => {
    if (isDirectory && isExpanded && !children && !isLoading) {
      setIsLoading(true);
      // Check cache first
      const cached = cache.get(entry.path);
      if (cached) {
        setChildren(cached);
        setIsLoading(false);
      } else {
        loadDirectory(entry.path).then((result) => {
          if (result) {
            cache.set(entry.path, result);
            setChildren(result);
          }
          setIsLoading(false);
        });
      }
    }
  }, [
    isDirectory,
    isExpanded,
    children,
    isLoading,
    entry.path,
    loadDirectory,
    cache,
  ]);

  // Calculate indent with subtle visual guides
  const indentSize = depth * 16;

  return (
    <div className="group">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          // Base layout
          "flex w-full items-center gap-2 text-left",
          // Height and padding
          "h-7 px-2",
          // Typography
          "text-[13px] leading-none",
          "font-[var(--app-font-mono)]",
          // Transitions
          "transition-all duration-150 ease-[var(--ease-out)]",
          // Interactive states
          "hover:bg-surface-2",
          "active:scale-[0.995]",
          // Selection state
          isSelected && [
            "bg-primary/8",
            "text-foreground",
          ],
          // Default text color
          !isSelected && [
            isDirectory ? "text-foreground/90" : "text-muted-foreground",
          ],
        )}
        style={{ paddingLeft: `${indentSize + 8}px` }}
      >
        {/* Expansion Chevron */}
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-sm",
            "transition-all duration-200 ease-[var(--ease-out)]",
            isDirectory
              ? [
                  "opacity-100",
                  "hover:bg-surface-3/50",
                ]
              : "opacity-0 pointer-events-none",
          )}
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/50",
              "transition-transform duration-200 ease-[var(--ease-spring)]",
              isExpanded && "rotate-90",
            )}
          />
        </span>

        {/* File/Folder Icon */}
        <span className="flex h-4 w-4 items-center justify-center">
          {isDirectory
            ? getFolderIcon(isExpanded, isSelected)
            : getFileIcon(entry.name, isSelected)}
        </span>

        {/* Filename */}
        <span
          className={cn(
            "truncate select-none",
            "transition-colors duration-150",
            isSelected ? "font-medium" : "font-normal",
          )}
        >
          {entry.name}
        </span>

        {/* Selection indicator line */}
        <span
          className={cn(
            "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full",
            "transition-all duration-150",
            isSelected
              ? "bg-primary opacity-100"
              : "bg-transparent opacity-0",
          )}
        />
      </button>

      {/* Children container with animated expand/collapse */}
      {isDirectory && (
        <div
          className={cn(
            "grid transition-all duration-200 ease-[var(--ease-out)]",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            {/* Visual connector line */}
            {isExpanded && depth < 3 && (
              <div
                className="absolute w-px bg-border/30"
                style={{
                  left: `${indentSize + 15}px`,
                  height: children ? `${children.entries.length * 28}px` : "0",
                  marginTop: "4px",
                }}
              />
            )}

            {children && (
              <div className="relative">
                {children.entries.map((child, index) => (
                  <div
                    key={child.path}
                    className={cn(
                      "transition-all duration-200",
                      "animate-in fade-in slide-in-from-left-2",
                    )}
                    style={{
                      animationDelay: `${index * 30}ms`,
                      animationFillMode: "both",
                    }}
                  >
                    <FileTreeItem
                      entry={child}
                      depth={depth + 1}
                      onToggle={onToggle}
                      onFileClick={onFileClick}
                      expandedPaths={expandedPaths}
                      loadDirectory={loadDirectory}
                      cache={cache}
                      selectedPath={selectedPath}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div
                className={cn(
                  "flex items-center gap-2 h-7 px-2",
                  "text-xs text-muted-foreground/60",
                )}
                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
              >
                <RefreshCw className="size-3 animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FileTree({ rootPath, onFileClick, className }: FileTreeProps) {
  const [rootListing, setRootListing] = React.useState<DirectoryListing | null>(
    null,
  );
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    new Set(),
  );
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const cache = React.useRef(new Map<string, DirectoryListing>());

  const loadDirectory = React.useCallback(async (path: string) => {
    try {
      const result = await window.pidesk.fs.readDirectory(path);
      return result;
    } catch (error) {
      console.error("Failed to read directory:", error);
      return null;
    }
  }, []);

  React.useEffect(() => {
    if (rootPath) {
      setIsLoading(true);
      loadDirectory(rootPath).then((result) => {
        setRootListing(result);
        setIsLoading(false);
        // Auto-expand root
        if (rootPath) {
          setExpandedPaths(new Set([rootPath]));
        }
      });
    } else {
      setRootListing(null);
    }
    // Reset expansion state when root path changes
    setExpandedPaths(new Set());
    setSelectedPath(null);
    cache.current.clear();
  }, [rootPath, loadDirectory]);

  const handleToggle = React.useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleFileClick = React.useCallback(
    (path: string) => {
      setSelectedPath(path);
      onFileClick?.(path);
    },
    [onFileClick],
  );

  // Empty state - No workspace
  if (!rootPath) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-8",
          "text-center",
          className,
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
          <Folder className="size-6 text-muted-foreground/40" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            No workspace
          </p>
          <p className="text-xs text-muted-foreground/60">
            Open a folder to browse files
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 p-4",
          className,
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 h-7",
              "animate-pulse",
            )}
            style={{ paddingLeft: `${i % 3 === 0 ? 8 : i % 3 === 1 ? 24 : 8}px` }}
          >
            <div className="h-4 w-4 rounded bg-surface-2" />
            <div className="h-3.5 w-24 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    );
  }

  // Empty directory state
  if (!rootListing || rootListing.entries.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-8",
          "text-center",
          className,
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
          <Layers className="size-6 text-muted-foreground/40" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Empty directory
          </p>
          <p className="text-xs text-muted-foreground/60">
            No files to display
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative py-1",
        className,
      )}
    >
      {rootListing.entries.map((entry, index) => (
        <div
          key={entry.path}
          className={cn(
            "transition-all duration-200",
            "animate-in fade-in slide-in-from-left-2",
          )}
          style={{
            animationDelay: `${index * 30}ms`,
            animationFillMode: "both",
          }}
        >
          <FileTreeItem
            entry={entry}
            depth={0}
            onToggle={handleToggle}
            onFileClick={handleFileClick}
            expandedPaths={expandedPaths}
            loadDirectory={loadDirectory}
            cache={cache.current}
            selectedPath={selectedPath}
          />
        </div>
      ))}
    </div>
  );
}
