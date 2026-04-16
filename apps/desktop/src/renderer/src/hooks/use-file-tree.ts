import type { FileEntry } from "@pi-desktop/shared/models/fs";
import { useCallback, useEffect, useRef, useState } from "react";

export interface FileTreeNode {
  entry: FileEntry;
  children: FileTreeNode[] | null;
  isLoading: boolean;
}

interface UseFileTreeReturn {
  rootNodes: FileTreeNode[];
  isRootLoading: boolean;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  refreshDirectory: (path: string) => void;
  refreshRoot: () => void;
}

export function useFileTree(workspacePath: string | null): UseFileTreeReturn {
  const [rootNodes, setRootNodes] = useState<FileTreeNode[]>([]);
  const [isRootLoading, setIsRootLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const cache = useRef<Map<string, FileTreeNode[]>>(new Map());
  const [, forceUpdate] = useState(0);

  const entriesToNodes = useCallback((entries: FileEntry[]): FileTreeNode[] => {
    return entries.map((entry) => {
      const cached = cache.current.get(entry.path);
      return {
        entry,
        children: cached ?? null,
        isLoading: false,
      };
    });
  }, []);

  const loadDirectory = useCallback(
    async (path: string): Promise<FileTreeNode[]> => {
      const listing = await window.piDesktop.fs.readDirectory(path);
      const nodes = entriesToNodes(listing.entries);
      cache.current.set(path, nodes);
      return nodes;
    },
    [entriesToNodes],
  );

  const loadRoot = useCallback(async () => {
    if (!workspacePath) return;
    setIsRootLoading(true);
    try {
      const listing = await window.piDesktop.fs.readDirectory(workspacePath);
      const nodes = entriesToNodes(listing.entries);
      cache.current.set("", nodes);
      setRootNodes(nodes);
    } catch (err) {
      console.error("[file-tree] Failed to load root directory:", err);
      setRootNodes([]);
    } finally {
      setIsRootLoading(false);
    }
  }, [workspacePath, entriesToNodes]);

  useEffect(() => {
    cache.current.clear();
    setExpandedPaths(new Set());
    setRootNodes([]);
    loadRoot();
  }, [loadRoot]);

  const rebuildNodes = useCallback(() => {
    const root = cache.current.get("");
    if (root) {
      const rebuild = (nodes: FileTreeNode[]): FileTreeNode[] =>
        nodes.map((node) => {
          const cached = cache.current.get(node.entry.path);
          return {
            ...node,
            children: cached ? rebuild(cached) : node.children,
          };
        });
      setRootNodes(rebuild(root));
    }
  }, []);

  const toggleExpand = useCallback(
    async (path: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
          return next;
        }
        next.add(path);
        return next;
      });

      if (cache.current.has(path)) {
        rebuildNodes();
        return;
      }

      // Mark loading
      forceUpdate((n) => n + 1);

      try {
        await loadDirectory(path);
        rebuildNodes();
      } catch (err) {
        console.error(`[file-tree] Failed to load directory: ${path}`, err);
      }
    },
    [loadDirectory, rebuildNodes],
  );

  const refreshDirectory = useCallback(
    async (path: string) => {
      cache.current.delete(path);
      try {
        await loadDirectory(path);
        rebuildNodes();
      } catch (err) {
        console.error(`[file-tree] Failed to refresh directory: ${path}`, err);
      }
    },
    [loadDirectory, rebuildNodes],
  );

  const refreshRoot = useCallback(() => {
    cache.current.clear();
    setExpandedPaths(new Set());
    loadRoot();
  }, [loadRoot]);

  return {
    rootNodes,
    isRootLoading,
    expandedPaths,
    toggleExpand,
    refreshDirectory,
    refreshRoot,
  };
}
