import { ArrowsLeftRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { RepositorySnapshot, WorktreeSnapshot } from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Folder,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Plus,
  Trash,
} from "@/components/ui/icons";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getTrafficLightInset } from "../../lib/title-bar-layout";
import { PlaceholderTab } from "./sidebar/placeholder-tab";

export { PlaceholderTab } from "./sidebar/placeholder-tab";

type IndicatorState = "streaming" | "unread" | "idle";

type SidebarTab = "workspaces" | "git" | "files";

const SIDEBAR_TABS: ReadonlyArray<{ id: SidebarTab; label: string }> = [
  { id: "workspaces", label: "Workspaces" },
  { id: "git", label: "Git" },
  { id: "files", label: "Files" },
];

export const SIDEBAR_WIDTH = 260;
export const MIN_SIDEBAR_WIDTH = 160;
export const MAX_SIDEBAR_WIDTH = 480;
const COLLAPSE_THRESHOLD = 100;

function getRepositoryName(repository: RepositorySnapshot): string {
  return repository.customName?.trim() || repository.name;
}

function StatusIndicator({ state }: { state: IndicatorState }) {
  if (state === "streaming") {
    return (
      <span aria-hidden="true" className="relative size-2 shrink-0">
        <span className="absolute inset-0 size-full bg-[var(--color-accent)]/70" />
        <span className="absolute inset-0 size-full bg-[var(--color-accent)]/40 animate-indicator-pulse" />
      </span>
    );
  }

  if (state === "unread") {
    return (
      <span
        aria-hidden="true"
        className="size-2 shrink-0 bg-[var(--color-secondary-accent)]/80"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 border border-white/20"
    />
  );
}

function idleUnlessUnread(state: IndicatorState): IndicatorState {
  if (state === "streaming") return "streaming";
  return state === "unread" ? "unread" : "idle";
}

export interface LeftSidebarProps {
  platform?: string | null;
  appVersion?: string;
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  activeTabOverride?: SidebarTab;
  isPromptExecuting?: boolean;
  threadLastViewedAt?: Record<string, number>;
  isLoading?: boolean;
  width: number;
  onResize: (width: number) => void;
  onSelectRepository: (repositoryId: string) => void;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onDeleteWorktree?: (worktreeId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onAddRepository: () => void;
  onOpenFilter?: () => void;
  onNewAgent?: () => void;
  onRemoveRepository?: (repositoryId: string) => void;
  onCopyRepositoryPath?: (repositoryId: string) => void;
  onOpenInFinder?: (repositoryId: string) => void;
  onCreateSession: () => void | Promise<void>;
  gitPanel?: React.ReactNode;
  filesPanel?: React.ReactNode;
}

function TreeConnector({
  count,
  rowHeight,
  startY,
  indent,
}: {
  count: number;
  rowHeight: number;
  startY: number;
  indent: number;
}) {
  if (count === 0) return null;

  const lastBranchY = startY + (count - 1) * rowHeight;

  return (
    <svg
      className="absolute pointer-events-none"
      aria-hidden="true"
      style={{
        left: 0,
        top: 0,
        width: indent + 6,
        height: lastBranchY + 1,
        overflow: "visible",
      }}
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={lastBranchY}
        stroke="rgba(255, 255, 255, 0.06)"
        strokeWidth={1}
      />

      {Array.from({ length: count }).map((_, i) => {
        const y = startY + i * rowHeight;
        return (
          <g key={i}>
            <line
              x1={0}
              y1={y}
              x2={indent - 2}
              y2={y}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth={1}
            />
            <line
              x1={indent - 2}
              y1={y}
              x2={indent + 4}
              y2={y}
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </svg>
  );
}

function SidebarEdgeToggle({
  label,
  side,
  onClick,
  onResizeDragStart,
}: {
  label: string;
  side: "left" | "right";
  onClick: () => void;
  onResizeDragStart?: (e: React.MouseEvent) => void;
}) {
  const Icon = side === "right" ? CaretLeft : CaretRight;
  const didDragRef = React.useRef(false);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (!onResizeDragStart) return;
      didDragRef.current = false;
      const startX = e.clientX;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (Math.abs(moveEvent.clientX - startX) > 3) {
          didDragRef.current = true;
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener(
        "mouseup",
        () => document.removeEventListener("mousemove", handleMouseMove),
        { once: true },
      );

      onResizeDragStart(e);
    },
    [onResizeDragStart],
  );

  return (
    <div
      className={cn(
        "group absolute inset-y-0 z-30 flex w-4 items-center justify-center",
        side === "right" ? "right-0 translate-x-1/2" : "left-1",
        onResizeDragStart && "cursor-ew-resize",
      )}
      onMouseDown={handleMouseDown}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={() => {
              if (!didDragRef.current) {
                onClick();
              }
            }}
            className={cn(
              "flex h-8 w-3 touch-manipulation items-center justify-center",
              "bg-[var(--color-bg-primary)] text-white/25",
              "border border-white/[0.10]",
              "opacity-0 group-hover:opacity-100",
              "transition-all duration-150 hover:text-white hover:border-white/30 hover:shadow-[0_0_8px_2px_rgba(255,255,255,0.08)]",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
              side === "right" ? "rounded-r-md" : "rounded-l-md",
            )}
          >
            <Icon aria-hidden="true" className="size-2" weight="bold" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side === "right" ? "left" : "right"}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

interface WorktreeRowProps {
  session: WorktreeSnapshot;
  isActive: boolean;
  indicatorState: IndicatorState;
  activeThreadId: string | null;
  isPromptExecuting?: boolean;
  threadLastViewedAt?: Record<string, number>;
  onSelect: (id: string) => void;
  onSelectThread: (threadId: string) => void;
}

interface ThreadRowProps {
  thread: WorktreeSnapshot["threads"][number];
  isActive: boolean;
  indicatorState: IndicatorState;
  onSelect: (id: string) => void;
}

function ThreadRowImpl({
  thread,
  isActive,
  indicatorState,
  onSelect,
}: ThreadRowProps) {
  const threadTitle = thread.title.trim() || "Untitled thread";

  return (
    <div data-testid="thread-row">
      <button
        type="button"
        onClick={() => onSelect(thread.id)}
        className={cn(
          "group flex w-full min-w-0 items-center gap-2 pl-[11px] pr-2 py-1.5 text-left text-[12px]",
          "transition-colors duration-150",
          isActive
            ? "text-white"
            : "text-white/40 hover:bg-white/[0.03] hover:text-white/65",
        )}
      >
        <StatusIndicator
          state={isActive ? indicatorState : idleUnlessUnread(indicatorState)}
        />
        <span className="min-w-0 flex-1 truncate">{threadTitle}</span>
      </button>
    </div>
  );
}

function WorktreeRowImpl({
  session,
  isActive,
  indicatorState,
  activeThreadId,
  isPromptExecuting,
  threadLastViewedAt,
  onSelect,
  onSelectThread,
}: WorktreeRowProps) {
  const ahead = session.git.ahead ?? 0;
  const behind = session.git.behind ?? 0;
  const isDirty = session.git.hasChanges ?? false;
  const prStatus = session.git.prStatus ?? null;

  // Pick the most salient git state icon.
  const gitStateIcon = (() => {
    if (prStatus === "merged") {
      return <GitMerge className="size-3.5 text-[var(--color-accent)]" />;
    }
    if (prStatus === "open") {
      return <GitPullRequest className="size-3.5 text-sky-400" />;
    }
    if (ahead > 0 && behind > 0) {
      return <ArrowsLeftRight className="size-3.5 text-white/40" />;
    }
    if (ahead > 0) {
      return <ArrowUp className="size-3.5 text-[var(--color-accent)]" />;
    }
    if (behind > 0) {
      return <ArrowDown className="size-3.5 text-white/40" />;
    }
    if (isDirty) {
      return <GitBranch className="size-3.5 text-white/40" />;
    }
    return <Check className="size-3.5 text-white/30" />;
  })();

  return (
    <div data-testid="session-row">
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        className={cn(
          "group flex w-full min-w-0 items-center gap-2 pl-[22px] pr-2 py-2 text-left text-[13px]",
          "transition-colors duration-150",
          isActive
            ? "text-white"
            : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]",
        )}
      >
        <StatusIndicator
          state={isActive ? indicatorState : idleUnlessUnread(indicatorState)}
        />

        <span className="min-w-0 flex-1 truncate font-mono">
          {session.label}
        </span>

        {(ahead > 0 || behind > 0) && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-white/40">
            {ahead > 0 && (
              <span className="text-[var(--color-accent)]">+{ahead}</span>
            )}
            {behind > 0 && <span className="text-white/40">−{behind}</span>}
          </span>
        )}

        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center"
        >
          {gitStateIcon}
        </span>
      </button>

      {session.threads.length > 0 && (
        <div className="relative ml-5 pl-4">
          <TreeConnector
            count={session.threads.length}
            rowHeight={28}
            startY={14}
            indent={16}
          />

          <div>
            {session.threads.map((thread) => {
              const isThreadActive = thread.id === activeThreadId;
              const isThreadStreaming =
                thread.runtime.status === "streaming" ||
                (isThreadActive && Boolean(isPromptExecuting));
              const threadIndicatorState: IndicatorState = isThreadStreaming
                ? "streaming"
                : !isThreadActive &&
                    thread.lastActivityAt !== null &&
                    thread.lastActivityAt >
                      (threadLastViewedAt?.[thread.id] ?? 0)
                  ? "unread"
                  : "idle";

              return (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  isActive={isThreadActive}
                  indicatorState={threadIndicatorState}
                  onSelect={onSelectThread}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const WorktreeRow = React.memo(WorktreeRowImpl);
const ThreadRow = React.memo(ThreadRowImpl);

interface ProjectRowProps {
  repository: RepositorySnapshot;
  isActive: boolean;
  isExpanded: boolean;
  sessionCount: number;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, repo: RepositorySnapshot) => void;
  onCreateSession?: () => void;
  isCreatingSession?: boolean;
}

function ProjectRowImpl({
  repository,
  isActive,
  isExpanded,
  sessionCount,
  onSelect,
  onContextMenu,
  onCreateSession,
  isCreatingSession,
}: ProjectRowProps) {
  return (
    <div
      data-testid="workspace-row"
      onContextMenu={(e) => onContextMenu(e, repository)}
      className="flex w-full items-center"
    >
      <button
        type="button"
        onClick={() => onSelect(repository.id)}
        className={cn(
          "group flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left",
          "transition-colors duration-150",
          isActive
            ? "text-white"
            : "text-white/60 hover:text-white/80 hover:bg-white/[0.01]",
        )}
      >
        <Folder
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 transition-colors duration-150",
            isActive
              ? "text-white/70"
              : "text-white/35 group-hover:text-white/55",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-medium",
            isActive && "text-white",
          )}
        >
          {getRepositoryName(repository).toUpperCase()}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1 pr-[7px]">
        {isActive && isExpanded && onCreateSession && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCreateSession}
                disabled={isCreatingSession}
                aria-label="New branch"
                data-testid="create-session-button"
                className="flex size-6 items-center justify-center text-white/30 transition-colors duration-150 hover:text-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <Plus aria-hidden="true" className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">New branch</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

const ProjectRow = React.memo(ProjectRowImpl);

export function LeftSidebarImpl({
  platform,
  appVersion,
  repositories,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  activeTabOverride,
  isPromptExecuting,
  threadLastViewedAt,
  isLoading,
  width,
  onResize,
  onSelectRepository,
  onSelectWorktree,
  onSelectThread,
  onDeleteThread: _onDeleteThread,
  onDeleteWorktree: _onDeleteWorktree,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onCreateSession,
  onAddRepository,
  gitPanel,
  filesPanel,
}: LeftSidebarProps) {
  const isCollapsed = width <= 0;
  const lastExpandedWidthRef = React.useRef(width > 0 ? width : SIDEBAR_WIDTH);

  React.useEffect(() => {
    if (width > 0) {
      lastExpandedWidthRef.current = width;
    }
  }, [width]);

  const [contextMenu, setContextMenu] = React.useState<{
    isOpen: boolean;
    x: number;
    y: number;
    repositoryId: string | null;
    repositoryName: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    repositoryId: null,
    repositoryName: "",
  });

  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);

  const [expandedRepositoryIds, setExpandedRepositoryIds] = React.useState<
    Set<string>
  >(() => (activeRepositoryId ? new Set([activeRepositoryId]) : new Set()));

  React.useEffect(() => {
    setExpandedRepositoryIds((current) => {
      const next = new Set(
        Array.from(current).filter((repositoryId) =>
          repositories.some((repository) => repository.id === repositoryId),
        ),
      );

      if (activeRepositoryId) {
        next.add(activeRepositoryId);
      }

      return next;
    });
  }, [activeRepositoryId, repositories]);

  React.useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu.isOpen]);

  const handleCreateSession = React.useCallback(async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      await onCreateSession();
    } finally {
      setIsCreatingSession(false);
    }
  }, [isCreatingSession, onCreateSession]);

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent, repository: RepositorySnapshot) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        repositoryId: repository.id,
        repositoryName: getRepositoryName(repository),
      });
    },
    [],
  );

  const handleMenuAction = React.useCallback((action: () => void) => {
    action();
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleSelectProject = React.useCallback(
    (repositoryId: string) => {
      const isActive = repositoryId === activeRepositoryId;
      const isExpanded = expandedRepositoryIds.has(repositoryId);

      setExpandedRepositoryIds((current) => {
        if (isActive && isExpanded) {
          const next = new Set(current);
          next.delete(repositoryId);
          return next;
        }
        return new Set([repositoryId]);
      });

      if (!isActive) {
        onSelectRepository(repositoryId);
      }
    },
    [activeRepositoryId, expandedRepositoryIds, onSelectRepository],
  );

  const contextMenuRepositoryId = contextMenu.repositoryId;

  const [activeTab, setActiveTab] = React.useState<SidebarTab>("workspaces");

  React.useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  const handleHideSidebar = React.useCallback(() => {
    if (isCollapsed) return;
    onResize(0);
  }, [isCollapsed, onResize]);

  const handleShowSidebar = React.useCallback(() => {
    onResize(lastExpandedWidthRef.current);
  }, [onResize]);

  const handleResizeDragStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = startWidth + delta;

        if (newWidth < COLLAPSE_THRESHOLD) {
          onResize(0);
        } else {
          onResize(
            Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth)),
          );
        }
      };

      const handleMouseUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, onResize],
  );

  return (
    <aside
      data-testid="left-sidebar"
      className={cn(
        "relative z-20 h-full shrink-0 overflow-visible select-none",
        !isCollapsed &&
          "flex flex-col bg-[var(--color-bg-primary)] border-r border-white/[0.06]",
      )}
      style={{ width }}
    >
      {isCollapsed ? (
        <SidebarEdgeToggle
          label="Show sidebar"
          side="left"
          onClick={handleShowSidebar}
        />
      ) : (
        <>
          {/* Top header row — branding aligned to the traffic-light lane */}
          <div
            className="shrink-0 h-11 flex items-center border-b border-white/[0.03]"
            style={{ paddingLeft: getTrafficLightInset(platform ?? null) + 56 }}
          >
            <span className="text-[10px] text-white/30 uppercase tracking-wider select-none">
              pi desktop{appVersion ? ` v${appVersion}` : ""}
            </span>
          </div>

          <div
            data-no-drag="true"
            className="flex h-11 w-full shrink-0 items-center gap-1 px-3"
            role="tablist"
            aria-label="Sidebar tabs"
          >
            {SIDEBAR_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`sidebar-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 h-8 px-3 text-[10px] uppercase tracking-wider font-medium text-center",
                    "transition-colors duration-150 border-b border-transparent",
                    isActive
                      ? "text-white/90 border-[var(--color-accent)]"
                      : "text-white/40 hover:text-white/70",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "workspaces" ? (
              <div className="py-2">
                {/* Projects */}
                <div className="space-y-0.5">
                  {repositories.map((repository) => {
                    const isActiveRepo = repository.id === activeRepositoryId;
                    const isExpanded = expandedRepositoryIds.has(repository.id);
                    const sessions = repository.worktrees;

                    return (
                      <div key={repository.id}>
                        <ProjectRow
                          repository={repository}
                          isActive={isActiveRepo}
                          isExpanded={isExpanded}
                          sessionCount={sessions.length}
                          onSelect={handleSelectProject}
                          onContextMenu={handleContextMenu}
                          onCreateSession={handleCreateSession}
                          isCreatingSession={isCreatingSession}
                        />

                        {isExpanded && (
                          <div className="relative ml-5 pl-5">
                            <TreeConnector
                              count={sessions.length}
                              rowHeight={80}
                              startY={18}
                              indent={20}
                            />

                            <Skeleton
                              name="session-list"
                              loading={Boolean(isLoading && isActiveRepo)}
                              fixture={[1, 2].map((i) => (
                                <div key={i} className="h-10" />
                              ))}
                            >
                              <div>
                                {sessions.map((session) => {
                                  const isSessionActive =
                                    session.id === activeWorktreeId;
                                  const isSessionWorking =
                                    session.threads.some(
                                      (thread) =>
                                        thread.runtime.status === "streaming",
                                    ) ||
                                    (isSessionActive &&
                                      Boolean(isPromptExecuting));
                                  const sessionIndicatorState: IndicatorState =
                                    isSessionWorking
                                      ? "streaming"
                                      : !isSessionActive &&
                                          session.threads.some(
                                            (t) =>
                                              t.lastActivityAt !== null &&
                                              t.lastActivityAt >
                                                (threadLastViewedAt?.[t.id] ??
                                                  0),
                                          )
                                        ? "unread"
                                        : "idle";

                                  return (
                                    <WorktreeRow
                                      key={session.id}
                                      session={session}
                                      isActive={isSessionActive}
                                      indicatorState={sessionIndicatorState}
                                      activeThreadId={activeThreadId}
                                      isPromptExecuting={isPromptExecuting}
                                      threadLastViewedAt={threadLastViewedAt}
                                      onSelect={onSelectWorktree}
                                      onSelectThread={onSelectThread}
                                    />
                                  );
                                })}
                              </div>
                            </Skeleton>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeTab === "git" ? (
              (gitPanel ?? <PlaceholderTab name="git" />)
            ) : (
              (filesPanel ?? <PlaceholderTab name="files" />)
            )}
          </div>

          <SidebarEdgeToggle
            label="Hide sidebar"
            side="right"
            onClick={handleHideSidebar}
            onResizeDragStart={handleResizeDragStart}
          />

          {/* Context Menu */}
          {contextMenu.isOpen && contextMenuRepositoryId !== null && (
            <div
              ref={contextMenuRef}
              className="fixed z-[100] min-w-[160px] border border-white/[0.06] bg-[var(--color-bg-primary)] p-0 shadow-lg"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <div className="px-3 py-2 border-b border-white/[0.06]">
                <span className="block truncate text-[12px] text-white/60">
                  {contextMenu.repositoryName}
                </span>
              </div>
              {onCopyRepositoryPath && (
                <button
                  type="button"
                  onClick={() =>
                    handleMenuAction(() =>
                      onCopyRepositoryPath(contextMenuRepositoryId),
                    )
                  }
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.04] transition-colors duration-150"
                >
                  <Copy className="size-4" />
                  Copy path
                </button>
              )}
              {onOpenInFinder && (
                <button
                  type="button"
                  onClick={() =>
                    handleMenuAction(() =>
                      onOpenInFinder(contextMenuRepositoryId),
                    )
                  }
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.04] transition-colors duration-150"
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <title>Open</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                    />
                  </svg>
                  Open in Finder
                </button>
              )}
              {onRemoveRepository && (
                <>
                  <div className="my-1 border-t border-white/[0.06]" />
                  <button
                    type="button"
                    onClick={() =>
                      handleMenuAction(() =>
                        onRemoveRepository(contextMenuRepositoryId),
                      )
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
                  >
                    <Trash className="size-4" />
                    Remove
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

export const LeftSidebar = React.memo(LeftSidebarImpl);
