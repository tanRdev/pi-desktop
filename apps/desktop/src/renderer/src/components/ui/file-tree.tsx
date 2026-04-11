import type { DirectoryListing, FileEntry } from "@pidesk/shared";
import * as React from "react";
import {
  Box,
  ChevronRight,
  Database,
  File,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Image,
  Layers,
  RefreshCw,
  Settings,
  Terminal,
} from "@/components/ui/icons";
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

const getFileIcon = (filename: string, isSelected: boolean) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const className = cn(
    "size-5 shrink-0 transition-all duration-200",
    isSelected ? "text-primary" : "text-white/30",
  );

  switch (ext) {
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
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
      return <Image className={className} />;
    case "env":
    case "config":
    case "ini":
    case "toml":
      return <Settings className={className} />;
    case "md":
    case "mdx":
    case "txt":
    case "doc":
    case "docx":
    case "pdf":
      return <FileText className={className} />;
    case "sql":
    case "db":
    case "sqlite":
      return <Database className={className} />;
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return <Box className={className} />;
    case "gitignore":
    case "gitattributes":
      return <GitBranch className={className} />;
    case "sh":
    case "bash":
    case "zsh":
    case "fish":
      return <Terminal className={className} />;
    default:
      return <File className={className} />;
  }
};

const getFolderIcon = (isExpanded: boolean, isSelected: boolean) => {
  const className = cn(
    "size-5 shrink-0 transition-all duration-200",
    isSelected
      ? "text-primary"
      : isExpanded
        ? "text-primary/80"
        : "text-primary/60",
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

  const indentSize = depth * 12;

  return (
    <div className="group">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-2 text-left",
          "h-6 px-2",
          "text-[14px] leading-none uppercase tracking-tight font-mono",
          "transition-all duration-150 ease-out",
          "hover:bg-white/[0.04]",
          isSelected && ["bg-white/[0.06]", "text-[#ffffff]"],
          !isSelected && [isDirectory ? "text-white/70" : "text-white/70"],
        )}
        style={{ paddingLeft: `${indentSize + 4}px` }}
      >
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center",
            "transition-all duration-200 ease-out",
            isDirectory
              ? ["opacity-100", "hover:bg-[#474747]/30"]
              : "opacity-0 pointer-events-none",
          )}
        >
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-white/30",
              "transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        </span>

        <span className="flex h-4 w-4 items-center justify-center">
          {isDirectory
            ? getFolderIcon(isExpanded, isSelected)
            : getFileIcon(entry.name, isSelected)}
        </span>

        <span className="truncate select-none">{entry.name}</span>

        <span
          className={cn(
            "absolute left-0 top-1/2 h-full w-0.5 -translate-y-1/2",
            "transition-all duration-150",
            isSelected ? "bg-primary opacity-100" : "bg-transparent opacity-0",
          )}
        />
      </button>

      {isDirectory && isExpanded && (
        <div className="relative">
          {isExpanded && depth < 3 && (
            <div
              className="absolute w-px bg-white/[0.04]"
              style={{
                left: `${indentSize + 11}px`,
                height: "100%",
                top: "0",
              }}
            />
          )}

          {children && (
            <div>
              {children.entries.map((child) => (
                <FileTreeItem
                  key={child.path}
                  entry={child}
                  depth={depth + 1}
                  onToggle={onToggle}
                  onFileClick={onFileClick}
                  expandedPaths={expandedPaths}
                  loadDirectory={loadDirectory}
                  cache={cache}
                  selectedPath={selectedPath}
                />
              ))}
            </div>
          )}

          {isLoading && (
            <div
              className="flex items-center gap-2 h-6 px-2 text-[14px] text-white/40 font-mono"
              style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
            >
              <RefreshCw className="size-3 animate-spin" />
              <span>LOADING...</span>
            </div>
          )}
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
        if (rootPath) {
          setExpandedPaths(new Set([rootPath]));
        }
      });
    } else {
      setRootListing(null);
    }
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

  if (!rootPath) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-8 text-center",
          className,
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center bg-white/[0.02] border border-white/[0.04]">
          <Folder className="size-6 text-white/30" />
        </div>
        <div className="space-y-1">
          <p className="font-headline text-[14px] font-bold uppercase tracking-widest text-primary">
            No workspace
          </p>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">
            Open a folder to browse files
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-1 p-4", className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn("flex items-center gap-2 h-6 animate-pulse")}
            style={{
              paddingLeft: `${i % 3 === 0 ? 4 : i % 3 === 1 ? 16 : 4}px`,
            }}
          >
            <div className="h-3.5 w-3.5 bg-white/[0.04]" />
            <div className="h-3 w-24 bg-white/[0.04]" />
          </div>
        ))}
      </div>
    );
  }

  if (!rootListing || rootListing.entries.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-8 text-center",
          className,
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center bg-white/[0.02] border border-white/[0.04]">
          <Layers className="size-6 text-white/30" />
        </div>
        <div className="space-y-1">
          <p className="font-headline text-[14px] font-bold uppercase tracking-widest text-primary">
            Empty directory
          </p>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">
            No files to display
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative py-1", className)}>
      {rootListing.entries.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={0}
          onToggle={handleToggle}
          onFileClick={handleFileClick}
          expandedPaths={expandedPaths}
          loadDirectory={loadDirectory}
          cache={cache.current}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}
