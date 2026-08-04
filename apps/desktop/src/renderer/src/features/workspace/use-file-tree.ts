import type { FileEntry } from "@pi-desktop/shared/models/fs";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

export type FileTreeRootState =
  | { status: "unavailable" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error" };

interface FileTreeRootSnapshot {
  workspacePath: string | null;
  state: FileTreeRootState;
  nodes: FileTreeNode[];
}

interface InFlightDirectoryLoad {
  generation: number;
  workspacePath: string;
  promise: Promise<void>;
}

const ROOT_UNAVAILABLE: FileTreeRootState = { status: "unavailable" };
const ROOT_LOADING: FileTreeRootState = { status: "loading" };
const ROOT_READY: FileTreeRootState = { status: "ready" };
const ROOT_ERROR: FileTreeRootState = { status: "error" };
const EMPTY_ROOT_NODES: FileTreeNode[] = [];

interface UseFileTreeReturn {
  rootNodes: FileTreeNode[];
  rootState: FileTreeRootState;
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
  onDirectoryLoadError?: () => void;
}

export function useFileTree(
  workspacePath: string | null,
  options: UseFileTreeOptions = {},
): UseFileTreeReturn {
  const { watchEvents$, onDirectoryLoadError } = options;
  const [rootSnapshot, setRootSnapshot] = useState<FileTreeRootSnapshot>(
    () => ({
      workspacePath,
      state: workspacePath ? ROOT_LOADING : ROOT_UNAVAILABLE,
      nodes: EMPTY_ROOT_NODES,
    }),
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const expandedPathsRef = useRef<Set<string>>(expandedPaths);
  const [_dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
  const cache = useRef<Map<string, FileTreeNode[]>>(new Map());
  const rootRequestId = useRef(0);
  const treeGeneration = useRef(0);
  const activeWorkspacePath = useRef(workspacePath);
  const inFlightDirectoryLoads = useRef<Map<string, InFlightDirectoryLoad>>(
    new Map(),
  );

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

  const readDirectoryNodes = useCallback(
    async (path: string): Promise<FileTreeNode[]> => {
      const listing = await window.piDesktop.fs.readDirectory(path);
      return entriesToNodes(listing.entries);
    },
    [entriesToNodes],
  );

  const advanceTreeGeneration = useCallback(() => {
    treeGeneration.current += 1;
    rootRequestId.current += 1;
    inFlightDirectoryLoads.current.clear();
    return treeGeneration.current;
  }, []);

  const isCurrentTreeGeneration = useCallback(
    (generation: number, requestedWorkspacePath: string | null) =>
      treeGeneration.current === generation &&
      activeWorkspacePath.current === requestedWorkspacePath,
    [],
  );

  const resetExpandedPaths = useCallback(() => {
    const next = new Set<string>();
    expandedPathsRef.current = next;
    setExpandedPaths(next);
  }, []);

  const setPathExpanded = useCallback((path: string, isExpanded: boolean) => {
    const current = expandedPathsRef.current;
    if (current.has(path) === isExpanded) return;
    const next = new Set(current);
    if (isExpanded) {
      next.add(path);
    } else {
      next.delete(path);
    }
    expandedPathsRef.current = next;
    setExpandedPaths(next);
  }, []);

  const loadRoot = useCallback(
    async (path: string | null) => {
      const requestId = rootRequestId.current + 1;
      rootRequestId.current = requestId;

      setRootSnapshot((current) => ({
        workspacePath: path,
        state: path ? ROOT_LOADING : ROOT_UNAVAILABLE,
        nodes:
          current.workspacePath === path ? current.nodes : EMPTY_ROOT_NODES,
      }));
      if (!path) return;

      try {
        const listing = await window.piDesktop.fs.readDirectory(path);
        if (rootRequestId.current !== requestId) return;
        const nodes = entriesToNodes(listing.entries);
        cache.current.set("", nodes);
        setRootSnapshot({ workspacePath: path, state: ROOT_READY, nodes });
      } catch (err) {
        if (rootRequestId.current !== requestId) return;
        console.error("[file-tree] Failed to load root directory:", err);
        cache.current.delete("");
        setRootSnapshot({
          workspacePath: path,
          state: ROOT_ERROR,
          nodes: EMPTY_ROOT_NODES,
        });
      }
    },
    [entriesToNodes],
  );

  useLayoutEffect(() => {
    activeWorkspacePath.current = workspacePath;
    advanceTreeGeneration();
    return () => {
      advanceTreeGeneration();
    };
  }, [advanceTreeGeneration, workspacePath]);

  useEffect(() => {
    cache.current.clear();
    resetExpandedPaths();
    setSelectedPathState(null);
    setMultiSelectedPaths(new Set());
    void loadRoot(workspacePath);
  }, [loadRoot, resetExpandedPaths, workspacePath]);

  const isCurrentWorkspace = rootSnapshot.workspacePath === workspacePath;
  let rootState = ROOT_UNAVAILABLE;
  if (isCurrentWorkspace) {
    rootState = rootSnapshot.state;
  } else if (workspacePath) {
    rootState = ROOT_LOADING;
  }
  const rootNodes = isCurrentWorkspace ? rootSnapshot.nodes : EMPTY_ROOT_NODES;
  const isRootLoading = rootState.status === "loading";

  const rebuildNodes = useCallback(
    (generation: number, requestedWorkspacePath: string) => {
      if (!isCurrentTreeGeneration(generation, requestedWorkspacePath)) return;
      const root = cache.current.get("");
      if (!root) return;

      const rebuild = (nodes: FileTreeNode[]): FileTreeNode[] =>
        nodes.map((node) => {
          const cached = cache.current.get(node.entry.path);
          return {
            ...node,
            children: cached ? rebuild(cached) : node.children,
          };
        });
      const nodes = rebuild(root);
      setRootSnapshot((current) => {
        if (
          !isCurrentTreeGeneration(generation, requestedWorkspacePath) ||
          current.workspacePath !== requestedWorkspacePath
        ) {
          return current;
        }
        return { ...current, nodes };
      });
    },
    [isCurrentTreeGeneration],
  );

  const loadDirectory = useCallback(
    async (
      path: string,
      generation: number,
      requestedWorkspacePath: string,
    ) => {
      if (!isCurrentTreeGeneration(generation, requestedWorkspacePath)) return;

      const currentRequest = inFlightDirectoryLoads.current.get(path);
      if (
        currentRequest?.generation === generation &&
        currentRequest.workspacePath === requestedWorkspacePath
      ) {
        await currentRequest.promise;
        return;
      }

      const request: InFlightDirectoryLoad = {
        generation,
        workspacePath: requestedWorkspacePath,
        promise: Promise.resolve(),
      };
      const promise = (async () => {
        try {
          const nodes = await readDirectoryNodes(path);
          if (!isCurrentTreeGeneration(generation, requestedWorkspacePath)) {
            return;
          }
          cache.current.set(path, nodes);
          rebuildNodes(generation, requestedWorkspacePath);
        } catch (err) {
          if (!isCurrentTreeGeneration(generation, requestedWorkspacePath)) {
            return;
          }
          console.error(`[file-tree] Failed to load directory: ${path}`, err);
          setPathExpanded(path, false);
          onDirectoryLoadError?.();
        } finally {
          if (inFlightDirectoryLoads.current.get(path) === request) {
            inFlightDirectoryLoads.current.delete(path);
          }
        }
      })();
      request.promise = promise;
      inFlightDirectoryLoads.current.set(path, request);
      await promise;
    },
    [
      isCurrentTreeGeneration,
      onDirectoryLoadError,
      readDirectoryNodes,
      rebuildNodes,
      setPathExpanded,
    ],
  );

  const toggleExpand = useCallback(
    async (path: string) => {
      const shouldExpand = !expandedPathsRef.current.has(path);
      setPathExpanded(path, shouldExpand);
      if (!shouldExpand) return;

      const generation = treeGeneration.current;
      const requestedWorkspacePath = activeWorkspacePath.current;
      if (!requestedWorkspacePath) {
        setPathExpanded(path, false);
        return;
      }

      if (cache.current.has(path)) {
        rebuildNodes(generation, requestedWorkspacePath);
        return;
      }

      await loadDirectory(path, generation, requestedWorkspacePath);
    },
    [loadDirectory, rebuildNodes, setPathExpanded],
  );

  const refreshDirectory = useCallback(
    async (path: string) => {
      const generation = treeGeneration.current;
      const requestedWorkspacePath = activeWorkspacePath.current;
      if (!requestedWorkspacePath) return;
      cache.current.delete(path);
      await loadDirectory(path, generation, requestedWorkspacePath);
    },
    [loadDirectory],
  );

  const refreshRoot = useCallback(() => {
    advanceTreeGeneration();
    cache.current.clear();
    resetExpandedPaths();
    setDirtyPaths(new Set());
    void loadRoot(workspacePath);
  }, [advanceTreeGeneration, loadRoot, resetExpandedPaths, workspacePath]);

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
    rootState,
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
