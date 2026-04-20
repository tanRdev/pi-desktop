import type { FileEntry } from "@pi-desktop/shared/models/fs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileChangeEvent, FileWatcherStream } from "@/lib/file-watcher";

export interface FileTreeNode {
  entry: FileEntry;
  children: FileTreeNode[] | null;
  isLoading: boolean;
}

/** A visible row in the flattened, filter-applied tree. */
export interface FlatFileTreeRow {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  /** True when a directory and it has cached children (used by nav). */
  hasChildren: boolean;
}

interface UseFileTreeReturn {
  rootNodes: FileTreeNode[];
  isRootLoading: boolean;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  refreshDirectory: (path: string) => void;
  refreshRoot: () => void;

  // --- Filter ---
  filter: string;
  setFilter: (value: string) => void;

  // --- Selection ---
  /** The "cursor" path — the currently focused row for keyboard nav. */
  selectedPath: string | null;
  setSelectedPath: (path: string | null) => void;
  /** Multi-select state. Always includes `selectedPath` when non-null. */
  multiSelectedPaths: Set<string>;
  /** Toggle a path in multi-selection (Cmd/Ctrl+Click). */
  toggleMultiSelect: (path: string) => void;
  /** Clear multi-selection to just the given path (or none). */
  setSingleSelection: (path: string | null) => void;

  /** Paths of files that received a "modify" event and have unsaved visual changes. */
  dirtyPaths: Set<string>;

  // --- Flat view (filter + expansion applied) ---
  flatRows: FlatFileTreeRow[];

  // --- Keyboard handler ---
  /**
   * Handle a keyboard event on the tree container. Returns true when
   * handled (caller should preventDefault).
   */
  handleKeyDown: (e: {
    key: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    preventDefault?: () => void;
  }) => boolean;
}

/** Case-insensitive subsequence match for quick filtering. */
function fuzzyMatch(name: string, query: string): boolean {
  if (!query) return true;
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < n.length && qi < q.length; i += 1) {
    if (n[i] === q[qi]) qi += 1;
  }
  return qi === q.length;
}

/**
 * Flatten the tree to the visible rows (respecting expansion + filter).
 *
 * Filter semantics: when a filter is set we show all descendants whose name
 * matches, plus all ancestor directories leading to a match (so the match
 * stays visible within its folder context). Matching directories auto-expand.
 */
function flattenTree(
  nodes: FileTreeNode[],
  expandedPaths: Set<string>,
  filter: string,
): FlatFileTreeRow[] {
  const out: FlatFileTreeRow[] = [];
  const hasFilter = filter.length > 0;

  function visit(node: FileTreeNode, depth: number): boolean {
    const isDir = node.entry.type === "directory";
    const selfMatches = hasFilter ? fuzzyMatch(node.entry.name, filter) : true;

    if (!hasFilter) {
      out.push({
        entry: node.entry,
        depth,
        isExpanded: expandedPaths.has(node.entry.path),
        hasChildren: isDir && (node.children?.length ?? 0) > 0,
      });
      if (isDir && expandedPaths.has(node.entry.path) && node.children) {
        for (const child of node.children) visit(child, depth + 1);
      }
      return true;
    }

    // Filter is active.
    if (isDir && node.children) {
      // Placeholder: we push the dir only if self matches OR a descendant matches.
      const insertIndex = out.length;
      out.push({
        entry: node.entry,
        depth,
        // Auto-expand while filtering.
        isExpanded: true,
        hasChildren: (node.children?.length ?? 0) > 0,
      });
      let anyChildMatched = false;
      for (const child of node.children) {
        if (visit(child, depth + 1)) anyChildMatched = true;
      }
      if (!(selfMatches || anyChildMatched)) {
        out.length = insertIndex; // roll back
        return false;
      }
      return true;
    }

    if (selfMatches) {
      out.push({
        entry: node.entry,
        depth,
        isExpanded: false,
        hasChildren: false,
      });
      return true;
    }
    return false;
  }

  for (const node of nodes) visit(node, 0);
  return out;
}

export interface UseFileTreeOptions {
  watchEvents$?: FileWatcherStream;
}

export function useFileTree(
  workspacePath: string | null,
  options: UseFileTreeOptions = {},
): UseFileTreeReturn {
  const { watchEvents$ } = options;
  const [rootNodes, setRootNodes] = useState<FileTreeNode[]>([]);
  const [isRootLoading, setIsRootLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [_dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
  const cache = useRef<Map<string, FileTreeNode[]>>(new Map());
  const [, forceUpdate] = useState(0);

  const [filter, setFilter] = useState("");
  const [selectedPath, setSelectedPathState] = useState<string | null>(null);
  const [multiSelectedPaths, setMultiSelectedPaths] = useState<Set<string>>(
    new Set(),
  );

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
    setSelectedPathState(null);
    setMultiSelectedPaths(new Set());
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
    setDirtyPaths(new Set());
    loadRoot();
  }, [loadRoot]);

  useEffect(() => {
    if (!watchEvents$) return;

    const unsubscribe = watchEvents$.subscribe((event: FileChangeEvent) => {
      switch (event.type) {
        case "create":
        case "delete":
        case "rename":
          refreshRoot();
          break;
        case "modify":
          setDirtyPaths((prev) => {
            const next = new Set(prev);
            next.add(event.path);
            return next;
          });
          break;
      }
    });

    return unsubscribe;
  }, [watchEvents$, refreshRoot]);

  const setSelectedPath = useCallback((path: string | null) => {
    setSelectedPathState(path);
    setMultiSelectedPaths((prev) => {
      // Keep the anchor path visible in multi-set.
      if (path === null) return prev.size === 0 ? prev : new Set();
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const setSingleSelection = useCallback((path: string | null) => {
    setSelectedPathState(path);
    setMultiSelectedPaths(new Set());
  }, []);

  const toggleMultiSelect = useCallback((path: string) => {
    setMultiSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    setSelectedPathState(path);
  }, []);

  const flatRows = useMemo(
    () => flattenTree(rootNodes, expandedPaths, filter),
    [rootNodes, expandedPaths, filter],
  );

  const handleKeyDown = useCallback(
    (e: {
      key: string;
      metaKey?: boolean;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      preventDefault?: () => void;
    }): boolean => {
      if (flatRows.length === 0) return false;
      const currentIndex = selectedPath
        ? flatRows.findIndex((row) => row.entry.path === selectedPath)
        : -1;

      function move(delta: number) {
        const next =
          currentIndex < 0
            ? delta > 0
              ? 0
              : flatRows.length - 1
            : Math.min(Math.max(currentIndex + delta, 0), flatRows.length - 1);
        const target = flatRows[next];
        if (target) setSingleSelection(target.entry.path);
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault?.();
          move(1);
          return true;
        case "ArrowUp":
          e.preventDefault?.();
          move(-1);
          return true;
        case "Home":
          e.preventDefault?.();
          {
            const first = flatRows[0];
            if (first) setSingleSelection(first.entry.path);
          }
          return true;
        case "End":
          e.preventDefault?.();
          {
            const last = flatRows[flatRows.length - 1];
            if (last) setSingleSelection(last.entry.path);
          }
          return true;
        case "ArrowRight": {
          if (currentIndex < 0) return false;
          const row = flatRows[currentIndex];
          if (!row) return false;
          if (row.entry.type !== "directory") return false;
          e.preventDefault?.();
          if (!row.isExpanded) {
            void toggleExpand(row.entry.path);
          } else {
            // already expanded → move into first child
            const child = flatRows[currentIndex + 1];
            if (child && child.depth > row.depth) {
              setSingleSelection(child.entry.path);
            }
          }
          return true;
        }
        case "ArrowLeft": {
          if (currentIndex < 0) return false;
          const row = flatRows[currentIndex];
          if (!row) return false;
          e.preventDefault?.();
          if (row.entry.type === "directory" && row.isExpanded) {
            void toggleExpand(row.entry.path);
          } else {
            // jump to parent
            for (let i = currentIndex - 1; i >= 0; i -= 1) {
              const candidate = flatRows[i];
              if (candidate && candidate.depth < row.depth) {
                setSingleSelection(candidate.entry.path);
                break;
              }
            }
          }
          return true;
        }
        default:
          return false;
      }
    },
    [flatRows, selectedPath, setSingleSelection, toggleExpand],
  );

  return {
    rootNodes,
    isRootLoading,
    expandedPaths,
    toggleExpand,
    refreshDirectory,
    refreshRoot,
    filter,
    setFilter,
    selectedPath,
    setSelectedPath,
    multiSelectedPaths,
    toggleMultiSelect,
    setSingleSelection,
    dirtyPaths: _dirtyPaths,
    flatRows,
    handleKeyDown,
  };
}
