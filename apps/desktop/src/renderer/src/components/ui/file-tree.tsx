import type { DirectoryListing, FileEntry } from "@pidesk/shared";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  rootPath: string | null | undefined;
  className?: string;
}

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  onToggle: (path: string) => void;
  expandedPaths: Set<string>;
  loadDirectory: (path: string) => Promise<DirectoryListing | null>;
  cache: Map<string, DirectoryListing>;
}

function FileTreeItem({
  entry,
  depth,
  onToggle,
  expandedPaths,
  loadDirectory,
  cache,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(entry.path);
  const isDirectory = entry.type === "directory";
  const [children, setChildren] = React.useState<DirectoryListing | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = React.useCallback(() => {
    if (isDirectory) {
      onToggle(entry.path);
    }
  }, [isDirectory, onToggle, entry.path]);

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
  }, [isDirectory, isExpanded, children, isLoading, entry.path, loadDirectory, cache]);

  const Icon = isDirectory ? (isExpanded ? FolderOpen : Folder) : File;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-sm transition hover:bg-surface-3",
          "text-muted-foreground hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {isDirectory && (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 transition-transform duration-150",
              isExpanded && "rotate-90",
            )}
          />
        )}
        {!isDirectory && <span className="w-3" />}
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{entry.name}</span>
      </button>
      {isDirectory && isExpanded && children && (
        <div>
          {children.entries.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              onToggle={onToggle}
              expandedPaths={expandedPaths}
              loadDirectory={loadDirectory}
              cache={cache}
            />
          ))}
        </div>
      )}
      {isDirectory && isExpanded && isLoading && (
        <div
          className="px-1.5 py-0.5 text-xs text-muted-foreground"
          style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
        >
          Loading...
        </div>
      )}
    </div>
  );
}

export function FileTree({ rootPath, className }: FileTreeProps) {
  const [rootListing, setRootListing] = React.useState<DirectoryListing | null>(
    null,
  );
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    new Set(),
  );
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
      });
    } else {
      setRootListing(null);
    }
    // Reset expansion state when root path changes
    setExpandedPaths(new Set());
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

  if (!rootPath) {
    return (
      <div className={cn("p-4 text-sm text-muted-foreground", className)}>
        No workspace selected
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("p-4 text-sm text-muted-foreground", className)}>
        Loading files...
      </div>
    );
  }

  if (!rootListing || rootListing.entries.length === 0) {
    return (
      <div className={cn("p-4 text-sm text-muted-foreground", className)}>
        Empty directory
      </div>
    );
  }

  return (
    <div className={cn("py-2", className)}>
      {rootListing.entries.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={0}
          onToggle={handleToggle}
          expandedPaths={expandedPaths}
          loadDirectory={loadDirectory}
          cache={cache.current}
        />
      ))}
    </div>
  );
}