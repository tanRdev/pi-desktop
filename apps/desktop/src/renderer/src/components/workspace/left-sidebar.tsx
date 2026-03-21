import type {
  RepositoryDisplayMetadata,
  RepositorySnapshot,
  ThreadSnapshot,
  WorktreeSnapshot,
} from "@pidesk/shared";
import {
  Bug,
  FolderOpen,
  FolderPlus,
  Puzzle,
  Search,
  Share2,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { LEFT_RAIL_WIDTH, type RailView } from "./left-rail";
import { WorktreeSection } from "./worktree-section";

const MIN_SIDEBAR_WIDTH = 140;
const MAX_SIDEBAR_WIDTH = 400;

type SearchEntry = {
  id: string;
  kind: "repository" | "worktree" | "thread";
  label: string;
  detail: string;
  meta: string;
  searchText: string;
  worktreeId?: string;
  threadId?: string;
};

function getRepositoryLabel(repository: RepositorySnapshot | null): string {
  if (!repository) {
    return "Workspace";
  }

  return repository.customName ?? repository.name;
}

function formatRelativeActivity(timestamp: number | null): string {
  if (!timestamp) {
    return "No activity";
  }

  const elapsed = Date.now() - timestamp;

  if (elapsed < 60_000) {
    return "Active now";
  }

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatGitSummary(worktree: WorktreeSnapshot): string {
  if (worktree.git.status !== "ready") {
    return worktree.git.message ?? "Git unavailable";
  }

  const parts: string[] = [];

  if (worktree.git.stagedCount > 0) {
    parts.push(`${worktree.git.stagedCount} staged`);
  }

  if (worktree.git.modifiedCount > 0) {
    parts.push(`${worktree.git.modifiedCount} modified`);
  }

  if (worktree.git.untrackedCount > 0) {
    parts.push(`${worktree.git.untrackedCount} untracked`);
  }

  if (parts.length === 0) {
    parts.push("Clean");
  }

  if ((worktree.git.ahead ?? 0) > 0 || (worktree.git.behind ?? 0) > 0) {
    parts.push(`A${worktree.git.ahead ?? 0}/B${worktree.git.behind ?? 0}`);
  }

  return parts.join("  |  ");
}

function getThreadStatusLabel(
  status: ThreadSnapshot["runtime"]["status"],
): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "streaming":
      return "Streaming";
    case "starting":
      return "Starting";
    case "error":
      return "Error";
    case "disconnected":
      return "Disconnected";
    case "exited":
      return "Exited";
    default:
      return status;
  }
}

function getThreadStatusTone(
  status: ThreadSnapshot["runtime"]["status"],
): string {
  switch (status) {
    case "streaming":
      return "text-white";
    case "ready":
      return "text-[#d0d0d0]";
    case "starting":
      return "text-[#a8a8a8]";
    case "error":
      return "text-[#f0c9c9]";
    case "disconnected":
    case "exited":
      return "text-[#8a8a8a]";
    default:
      return "text-[#919191]";
  }
}

function getViewInfo(view: RailView): { title: string; icon: React.ReactNode } {
  switch (view) {
    case "explorer":
      return { title: "EXPLORER", icon: <FolderOpen className="size-4" /> };
    case "search":
      return { title: "SEARCH", icon: <Search className="size-4" /> };
    case "source":
      return { title: "SOURCE CONTROL", icon: <Share2 className="size-4" /> };
    case "debug":
      return { title: "DEBUG", icon: <Bug className="size-4" /> };
    case "extensions":
      return { title: "EXTENSIONS", icon: <Puzzle className="size-4" /> };
    default:
      return { title: "WORKSPACE", icon: <FolderOpen className="size-4" /> };
  }
}

export interface LeftSidebarProps {
  repository: RepositorySnapshot | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  activeView?: RailView;
  onUpdateRepositoryPreferences: (
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ) => void | Promise<void>;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: (worktreeId: string) => void;
  onCreateWorktree: () => void;
  onCloseThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
  width: number;
  onResize: (width: number) => void;
  isCollapsed: boolean;
  className?: string;
}

export function LeftSidebar({
  repository,
  activeWorktreeId,
  activeThreadId,
  activeView,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCreateWorktree,
  onCloseThread,
  onRenameThread,
  width,
  onResize,
  isCollapsed,
  className,
}: LeftSidebarProps) {
  const [expandedWorktreeId, setExpandedWorktreeId] = React.useState<
    string | null
  >(activeWorktreeId);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    if (activeWorktreeId) {
      setExpandedWorktreeId(activeWorktreeId);
    }
  }, [activeWorktreeId]);

  const [isResizing, setIsResizing] = React.useState(false);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - LEFT_RAIL_WIDTH;
      onResize(
        Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth)),
      );
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onResize]);

  const handleToggleWorktree = React.useCallback(
    (worktreeId: string) => {
      if (expandedWorktreeId === worktreeId) {
        setExpandedWorktreeId(null);
      } else {
        setExpandedWorktreeId(worktreeId);
        onSelectWorktree(worktreeId);
      }
    },
    [expandedWorktreeId, onSelectWorktree],
  );

  const worktrees = repository?.worktrees ?? [];
  const resolvedActiveView = activeView ?? null;

  const viewInfo = getViewInfo(resolvedActiveView);
  const repositoryLabel = getRepositoryLabel(repository);
  const totalThreadCount = worktrees.reduce(
    (count, worktree) =>
      count + worktree.threads.filter((thread) => !thread.isArchived).length,
    0,
  );
  const dirtyWorktreeCount = worktrees.filter(
    (worktree) => worktree.git.hasChanges,
  ).length;
  const liveThreadCount = worktrees.reduce(
    (count, worktree) =>
      count +
      worktree.threads.filter(
        (thread) =>
          !thread.isArchived &&
          (thread.runtime.status === "streaming" ||
            thread.runtime.status === "starting"),
      ).length,
    0,
  );
  const readyGitCount = worktrees.filter(
    (worktree) => worktree.git.status === "ready",
  ).length;

  const searchEntries = React.useMemo<SearchEntry[]>(() => {
    if (!repository) {
      return [];
    }

    const entries: SearchEntry[] = [
      {
        id: `repository-${repository.id}`,
        kind: "repository",
        label: repositoryLabel,
        detail: repository.rootPath,
        meta: repository.defaultBranch ?? "No default branch",
        searchText: [
          repositoryLabel,
          repository.rootPath,
          repository.defaultBranch ?? "",
        ]
          .join(" ")
          .toLowerCase(),
      },
    ];

    for (const worktree of worktrees) {
      entries.push({
        id: `worktree-${worktree.id}`,
        kind: "worktree",
        label: worktree.label,
        detail: worktree.path,
        meta:
          worktree.git.branch ??
          worktree.git.commit?.slice(0, 7) ??
          "No git ref",
        searchText: [
          worktree.label,
          worktree.path,
          worktree.git.branch ?? "",
          worktree.git.commit ?? "",
          worktree.git.message ?? "",
        ]
          .join(" ")
          .toLowerCase(),
        worktreeId: worktree.id,
      });

      for (const thread of worktree.threads.filter(
        (item) => !item.isArchived,
      )) {
        entries.push({
          id: `thread-${thread.id}`,
          kind: "thread",
          label: thread.title,
          detail: worktree.label,
          meta: getThreadStatusLabel(thread.runtime.status),
          searchText: [
            thread.title,
            worktree.label,
            worktree.path,
            thread.runtime.status,
            thread.runtime.lastError ?? "",
          ]
            .join(" ")
            .toLowerCase(),
          worktreeId: worktree.id,
          threadId: thread.id,
        });
      }
    }

    return entries;
  }, [repository, repositoryLabel, worktrees]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = React.useMemo(() => {
    if (!normalizedSearchQuery) {
      return searchEntries.slice(0, 10);
    }

    return searchEntries.filter((entry) =>
      entry.searchText.includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, searchEntries]);

  const runtimeThreads = React.useMemo(() => {
    return worktrees
      .flatMap((worktree) =>
        worktree.threads
          .filter((thread) => !thread.isArchived)
          .map((thread) => ({ thread, worktree })),
      )
      .sort(
        (left, right) =>
          (right.thread.lastActivityAt ?? 0) -
          (left.thread.lastActivityAt ?? 0),
      );
  }, [worktrees]);

  const runtimeCounts = React.useMemo(() => {
    return runtimeThreads.reduce<Record<string, number>>((counts, item) => {
      counts[item.thread.runtime.status] =
        (counts[item.thread.runtime.status] ?? 0) + 1;
      return counts;
    }, {});
  }, [runtimeThreads]);

  const sourceMetrics = React.useMemo(() => {
    return worktrees.reduce(
      (metrics, worktree) => {
        metrics.staged += worktree.git.stagedCount;
        metrics.modified += worktree.git.modifiedCount;
        metrics.untracked += worktree.git.untrackedCount;
        metrics.ahead += worktree.git.ahead ?? 0;
        metrics.behind += worktree.git.behind ?? 0;
        return metrics;
      },
      { staged: 0, modified: 0, untracked: 0, ahead: 0, behind: 0 },
    );
  }, [worktrees]);

  const handleSelectSearchEntry = React.useCallback(
    (entry: SearchEntry) => {
      if (entry.worktreeId) {
        onSelectWorktree(entry.worktreeId);
      }

      if (entry.threadId) {
        onSelectThread(entry.threadId);
      }
    },
    [onSelectThread, onSelectWorktree],
  );

  const viewContent = React.useMemo(() => {
    switch (resolvedActiveView) {
      case "search":
        return (
          <div className="space-y-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search worktrees or threads"
              placeholder="Search worktrees or threads"
              className={cn(
                "h-9 w-full border-b border-[#474747]/35 bg-[#101010] px-3 font-mono text-xs text-white outline-none",
                "placeholder:text-[#5f5f5f] focus:border-white",
              )}
            />

            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
              <span>{normalizedSearchQuery ? "Matches" : "Indexed"}</span>
              <span>{searchResults.length}</span>
            </div>

            <div className="space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    disabled={entry.kind === "repository"}
                    onClick={() => handleSelectSearchEntry(entry)}
                    className={cn(
                      "flex w-full flex-col gap-1 bg-[#131313] px-3 py-2 text-left",
                      "transition-[transform,background-color,color] duration-150 ease-out",
                      entry.kind === "repository"
                        ? "cursor-default disabled:opacity-100"
                        : "hover:bg-[#181818] hover:text-white active:scale-[0.99]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
                        {entry.kind}
                      </span>
                      <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
                        {entry.meta}
                      </span>
                    </div>
                    <span className="truncate text-sm text-white">
                      {entry.label}
                    </span>
                    <span className="truncate font-mono text-[11px] text-[#8a8a8a]">
                      {entry.detail}
                    </span>
                  </button>
                ))
              ) : (
                <div className="bg-[#131313] px-3 py-4 font-mono text-xs text-[#7a7a7a]">
                  No worktrees or threads match `{searchQuery}`.
                </div>
              )}
            </div>
          </div>
        );
      case "source":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Dirty", value: dirtyWorktreeCount },
                { label: "Staged", value: sourceMetrics.staged },
                { label: "Modified", value: sourceMetrics.modified },
                { label: "Untracked", value: sourceMetrics.untracked },
              ].map((metric) => (
                <div key={metric.label} className="bg-[#131313] px-3 py-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
                    {metric.label}
                  </div>
                  <div className="mt-1 text-lg text-white">{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {worktrees.length > 0 ? (
                worktrees.map((worktree) => (
                  <button
                    key={worktree.id}
                    type="button"
                    onClick={() => onSelectWorktree(worktree.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 bg-[#131313] px-3 py-2 text-left",
                      "transition-[transform,background-color] duration-150 ease-out",
                      "hover:bg-[#181818] active:scale-[0.99]",
                      activeWorktreeId === worktree.id && "bg-[#1f1f1f]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-white">
                        {worktree.label}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
                        {worktree.git.branch ?? "Detached"}
                      </span>
                    </div>
                    <span className="truncate font-mono text-[11px] text-[#8a8a8a]">
                      {formatGitSummary(worktree)}
                    </span>
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[#5f5f5f]">
                      {worktree.git.commit?.slice(0, 7) ?? worktree.path}
                    </span>
                  </button>
                ))
              ) : (
                <div className="bg-[#131313] px-3 py-4 font-mono text-xs text-[#7a7a7a]">
                  No worktrees available for source inspection.
                </div>
              )}
            </div>
          </div>
        );
      case "debug":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Live", value: liveThreadCount },
                { label: "Ready", value: runtimeCounts.ready ?? 0 },
                { label: "Errors", value: runtimeCounts.error ?? 0 },
                {
                  label: "Offline",
                  value:
                    (runtimeCounts.disconnected ?? 0) +
                    (runtimeCounts.exited ?? 0),
                },
              ].map((metric) => (
                <div key={metric.label} className="bg-[#131313] px-3 py-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
                    {metric.label}
                  </div>
                  <div className="mt-1 text-lg text-white">{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {runtimeThreads.length > 0 ? (
                runtimeThreads.map(({ thread, worktree }) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => onSelectThread(thread.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 bg-[#131313] px-3 py-2 text-left",
                      "transition-[transform,background-color] duration-150 ease-out",
                      "hover:bg-[#181818] active:scale-[0.99]",
                      activeThreadId === thread.id && "bg-[#1f1f1f]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-white">
                        {thread.title}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px] uppercase tracking-[0.08em]",
                          getThreadStatusTone(thread.runtime.status),
                        )}
                      >
                        {getThreadStatusLabel(thread.runtime.status)}
                      </span>
                    </div>
                    <span className="truncate font-mono text-[11px] text-[#8a8a8a]">
                      {worktree.label} |{" "}
                      {formatRelativeActivity(thread.lastActivityAt)}
                    </span>
                    {thread.runtime.lastError ? (
                      <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[#b48f8f]">
                        {thread.runtime.lastError}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="bg-[#131313] px-3 py-4 font-mono text-xs text-[#7a7a7a]">
                  No threads are available for runtime inspection.
                </div>
              )}
            </div>
          </div>
        );
      case "extensions":
        return (
          <div className="space-y-2">
            {[
              {
                label: "Explorer Surface",
                state: worktrees.length > 0 ? "Mounted" : "Idle",
                detail: `${worktrees.length} worktrees / ${totalThreadCount} visible threads`,
              },
              {
                label: "Search Index",
                state: searchEntries.length > 0 ? "Ready" : "Empty",
                detail: `${searchEntries.length} indexed workspace records`,
              },
              {
                label: "Source Inspector",
                state: readyGitCount > 0 ? "Ready" : "Degraded",
                detail: `${readyGitCount} git-ready worktrees, A${sourceMetrics.ahead}/B${sourceMetrics.behind}`,
              },
              {
                label: "Runtime Monitor",
                state: runtimeThreads.length > 0 ? "Attached" : "Idle",
                detail: `${liveThreadCount} live threads, ${runtimeCounts.error ?? 0} errors`,
              },
            ].map((module) => (
              <div key={module.label} className="bg-[#131313] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white">{module.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
                    {module.state}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-[#8a8a8a]">
                  {module.detail}
                </div>
              </div>
            ))}

            <div className="bg-[#131313] px-3 py-3 font-mono text-[11px] text-[#7a7a7a]">
              Extension status is derived from the live workspace surfaces
              above, so this panel doubles as an operator view for what is
              mounted, indexed, or degraded in the current project.
            </div>
          </div>
        );
      case "explorer":
        return (
          <>
            {worktrees.map((worktree, index) => (
              <div
                key={worktree.id}
                className="stagger-item"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <WorktreeSection
                  worktree={worktree}
                  activeWorktreeId={activeWorktreeId}
                  activeThreadId={activeThreadId}
                  isExpanded={expandedWorktreeId === worktree.id}
                  onToggleExpand={() => handleToggleWorktree(worktree.id)}
                  onSelectThread={onSelectThread}
                  onCreateThread={() => onCreateThread(worktree.id)}
                  onCloseThread={onCloseThread}
                  onRenameThread={onRenameThread}
                />
              </div>
            ))}
            {worktrees.length === 0 && (
              <div className="bg-[#131313] px-3 py-4 font-mono text-xs text-[#7a7a7a]">
                No worktrees
              </div>
            )}
          </>
        );
      default:
        return (
          <div className="space-y-3">
            <div className="bg-[#131313] px-3 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
                Active repository
              </div>
              <div className="mt-2 text-base text-white">{repositoryLabel}</div>
              <div className="mt-1 font-mono text-[11px] text-[#8a8a8a]">
                {repository?.rootPath ??
                  "Select a repository from the rail to begin."}
              </div>
              {repository?.defaultBranch ? (
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#5f5f5f]">
                  Default branch {repository.defaultBranch}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Worktrees", value: worktrees.length },
                { label: "Threads", value: totalThreadCount },
                { label: "Dirty", value: dirtyWorktreeCount },
                { label: "Live", value: liveThreadCount },
              ].map((metric) => (
                <div key={metric.label} className="bg-[#131313] px-3 py-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
                    {metric.label}
                  </div>
                  <div className="mt-1 text-lg text-white">{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#131313] px-3 py-3 font-mono text-[11px] text-[#7a7a7a]">
              Use the rail to enter a workspace surface, or hit Back in the rail
              to switch repositories.
            </div>
          </div>
        );
    }
  }, [
    activeThreadId,
    activeWorktreeId,
    dirtyWorktreeCount,
    handleSelectSearchEntry,
    liveThreadCount,
    onCloseThread,
    onCreateThread,
    onRenameThread,
    onSelectThread,
    onSelectWorktree,
    repository,
    repositoryLabel,
    normalizedSearchQuery,
    readyGitCount,
    resolvedActiveView,
    runtimeCounts,
    runtimeThreads,
    searchEntries.length,
    searchQuery,
    searchResults,
    sourceMetrics,
    totalThreadCount,
    worktrees,
    expandedWorktreeId,
    handleToggleWorktree,
  ]);

  const showNewWorktreeButton = resolvedActiveView === "explorer" && repository;

  return (
    <aside
      data-testid="left-sidebar"
      data-state={isCollapsed ? "collapsed" : "expanded"}
      className={cn(
        "relative z-10 flex h-full shrink-0 overflow-hidden bg-[#0e0e0e]",
        "transition-[margin-left,width] duration-150 ease-[var(--ease-out)]",
        isCollapsed && "overflow-hidden",
        className,
      )}
      style={{
        marginLeft: isCollapsed ? 0 : LEFT_RAIL_WIDTH,
        width: isCollapsed ? 0 : width,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {!isCollapsed && (
          <div className="flex items-center gap-1.5 border-b border-[#474747]/15 px-2.5 py-1.5">
            <span className="text-[#6f6f6f]">{viewInfo.icon}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#919191]">
              {viewInfo.title}
            </span>
          </div>
        )}

        {!repository ? (
          <div className="px-2 pt-2">
            <div className="bg-[#131313] px-3 py-4 font-mono text-xs text-[#7a7a7a]">
              Add a repository to start a workspace.
            </div>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-2 py-2">{viewContent}</div>
        </ScrollArea>

        {!isCollapsed && showNewWorktreeButton && (
          <div className="border-t border-[#474747]/15 px-2 py-2">
            <button
              type="button"
              className={cn(
                "flex h-8 w-full items-center gap-2 bg-[#131313] px-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8a8a8a]",
                "transition-[transform,background-color,color] duration-150 ease-out",
                "hover:bg-[#181818] hover:text-white active:scale-[0.99]",
              )}
              onClick={onCreateWorktree}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              New worktree
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize",
            "hover:bg-ring/10 transition-colors duration-150 ease-[var(--ease-out)]",
            "motion-reduce:transition-none",
            isResizing && "bg-ring/20",
          )}
          onMouseDown={() => setIsResizing(true)}
          title="Drag to resize"
          role="presentation"
          aria-hidden="true"
        />
      )}
    </aside>
  );
}
