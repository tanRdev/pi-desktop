import { ArrowsLeftRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { RepositorySnapshot, WorktreeSnapshot } from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import {
  Archive,
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
import { getTrafficLightInset } from "@/lib/title-bar-layout";
import { cn } from "@/lib/utils";
import { PlaceholderTab } from "./sidebar/placeholder-tab";
import {
  type SidebarTab,
  useLeftSidebarLayout,
} from "./use-left-sidebar-layout";
import { useLeftSidebarMenus } from "./use-left-sidebar-menus";

export { PlaceholderTab } from "./sidebar/placeholder-tab";
export {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH,
} from "./use-left-sidebar-layout";

type IndicatorState = "streaming" | "unread" | "idle";

const SIDEBAR_TABS: ReadonlyArray<{ id: SidebarTab; label: string }> = [
  { id: "workspaces", label: "Workspaces" },
  { id: "git", label: "Git" },
  { id: "files", label: "Files" },
];

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

function passiveIndicatorState(state: IndicatorState): IndicatorState {
  if (state === "streaming") return "streaming";
  if (state === "unread") return "unread";
  return "idle";
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
  onArchiveWorktree?: (worktreeId: string) => void;
  onArchiveThread?: (threadId: string) => void;
  onCreateThread?: (worktreeId: string) => void;
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
  repositoryName: string;
  isActive: boolean;
  indicatorState: IndicatorState;
  activeThreadId: string | null;
  isPromptExecuting?: boolean;
  threadLastViewedAt?: Record<string, number>;
  onSelect: (id: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread?: (worktreeId: string) => void;
  onContextMenu?: (
    e: React.MouseEvent,
    worktreeId: string,
    worktreeLabel: string,
  ) => void;
  onThreadContextMenu?: (
    e: React.MouseEvent,
    threadId: string,
    threadTitle: string,
  ) => void;
}

interface ThreadRowProps {
  thread: WorktreeSnapshot["threads"][number];
  repositoryName: string;
  worktreeName: string;
  isActive: boolean;
  indicatorState: IndicatorState;
  onSelect: (id: string) => void;
  onContextMenu?: (
    e: React.MouseEvent,
    threadId: string,
    threadTitle: string,
  ) => void;
}

function ThreadRowImpl({
  thread,
  repositoryName,
  worktreeName,
  isActive,
  indicatorState,
  onSelect,
  onContextMenu,
}: ThreadRowProps) {
  const threadTitle = thread.title.trim() || "Untitled thread";
  const tooltipText = `${repositoryName} › ${worktreeName} › ${threadTitle}`;

  return (
    <div data-testid="thread-row">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(thread.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu?.(e, thread.id, threadTitle);
            }}
            className={cn(
              "group flex w-full min-w-0 items-center gap-2 pl-[11px] pr-2 py-1.5 text-left text-[12px]",
              "transition-colors duration-150",
              isActive
                ? "text-white"
                : "text-white/40 hover:bg-white/[0.03] hover:text-white/65",
            )}
          >
            <StatusIndicator
              state={
                isActive
                  ? indicatorState
                  : passiveIndicatorState(indicatorState)
              }
            />
            <span className="min-w-0 flex-1 truncate">{threadTitle}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{tooltipText}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function WorktreeRowImpl({
  session,
  repositoryName,
  isActive,
  indicatorState,
  activeThreadId,
  isPromptExecuting,
  threadLastViewedAt,
  onSelect,
  onSelectThread,
  onCreateThread,
  onContextMenu,
  onThreadContextMenu,
}: WorktreeRowProps) {
  const ahead = session.git.ahead ?? 0;
  const behind = session.git.behind ?? 0;
  const isDirty = session.git.hasChanges ?? false;
  const prStatus = session.git.prStatus ?? null;
  const tooltipText = `${repositoryName} › ${session.label}`;

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
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onSelect(session.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu?.(e, session.id, session.label);
              }}
              className={cn(
                "group flex min-w-0 flex-1 items-center gap-2 pl-[22px] pr-2 py-2 text-left text-[13px]",
                "transition-colors duration-150",
                isActive
                  ? "text-white"
                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]",
              )}
            >
              <StatusIndicator
                state={
                  isActive
                    ? indicatorState
                    : passiveIndicatorState(indicatorState)
                }
              />

              <span className="min-w-0 flex-1 truncate font-mono">
                {session.label}
              </span>

              {(ahead > 0 || behind > 0) && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-white/40">
                  {ahead > 0 && (
                    <span className="text-[var(--color-accent)]">+{ahead}</span>
                  )}
                  {behind > 0 && (
                    <span className="text-white/40">−{behind}</span>
                  )}
                </span>
              )}

              <span
                aria-hidden="true"
                className="flex shrink-0 items-center justify-center"
              >
                {gitStateIcon}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{tooltipText}</TooltipContent>
        </Tooltip>
        {isActive && onCreateThread && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onCreateThread(session.id)}
                aria-label="New thread"
                className="flex size-6 shrink-0 items-center justify-center text-white/30 transition-colors duration-150 hover:text-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <Plus aria-hidden="true" className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">New thread</TooltipContent>
          </Tooltip>
        )}
      </div>

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
                  repositoryName={repositoryName}
                  worktreeName={session.label}
                  isActive={isThreadActive}
                  indicatorState={threadIndicatorState}
                  onSelect={onSelectThread}
                  onContextMenu={onThreadContextMenu}
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
  onCreateSession?: () => void | Promise<void>;
  isCreatingSession?: boolean;
}

function ProjectRowImpl({
  repository,
  isActive,
  isExpanded,
  sessionCount: _sessionCount,
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
      <Tooltip>
        <TooltipTrigger asChild>
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
              {getRepositoryName(repository)}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {getRepositoryName(repository)}
        </TooltipContent>
      </Tooltip>

      <div className="flex shrink-0 items-center gap-1 pr-[7px]">
        {isActive && isExpanded && onCreateSession && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  void onCreateSession();
                }}
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
  appVersion: _appVersion,
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
  onDeleteThread,
  onDeleteWorktree,
  onArchiveThread,
  onArchiveWorktree,
  onCreateThread,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onCreateSession,
  onAddRepository,
  gitPanel,
  filesPanel,
}: LeftSidebarProps) {
  const {
    contextMenu,
    contextMenuRef,
    itemMenu,
    itemMenuRef,
    openRepositoryMenu,
    runRepositoryMenuAction,
    openThreadMenu,
    openWorktreeMenu,
    clearItemMenuConfirmation,
    confirmItemAction,
  } = useLeftSidebarMenus();

  const {
    isCollapsed,
    isCreatingSession,
    activeTab,
    expandedRepositoryIds,
    setActiveTab,
    handleSelectProject,
    handleCreateSession,
    handleHideSidebar,
    handleShowSidebar,
    handleResizeDragStart,
  } = useLeftSidebarLayout({
    width,
    activeRepositoryId,
    activeTabOverride,
    onResize,
    onSelectRepository,
    onCreateSession,
  });

  const handleThreadContextMenu = React.useCallback(
    (e: React.MouseEvent, threadId: string, threadTitle: string) => {
      openThreadMenu(e, { threadId, threadTitle });
    },
    [openThreadMenu],
  );

  const handleWorktreeContextMenu = React.useCallback(
    (e: React.MouseEvent, worktreeId: string, worktreeLabel: string) => {
      openWorktreeMenu(e, { worktreeId, worktreeLabel });
    },
    [openWorktreeMenu],
  );

  const handleItemMenuConfirmAction = React.useCallback(
    (action: "archive" | "delete") => {
      confirmItemAction(action, {
        onDeleteThread,
        onDeleteWorktree,
        onArchiveThread,
        onArchiveWorktree,
      });
    },
    [
      confirmItemAction,
      onDeleteThread,
      onDeleteWorktree,
      onArchiveThread,
      onArchiveWorktree,
    ],
  );

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent, repository: RepositorySnapshot) => {
      openRepositoryMenu(e, {
        repositoryId: repository.id,
        repositoryName: getRepositoryName(repository),
      });
    },
    [openRepositoryMenu],
  );

  const handleMenuAction = React.useCallback(
    (action: () => void | Promise<void>) => {
      runRepositoryMenuAction(action);
    },
    [runRepositoryMenuAction],
  );

  const contextMenuRepositoryId = contextMenu.repositoryId;

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
            className="shrink-0 h-11"
            style={{
              display: "grid",
              gridTemplateColumns:
                platform === "darwin"
                  ? `${getTrafficLightInset(platform) + 64}px 1fr`
                  : "1fr",
            }}
          >
            <div
              className="flex h-full items-center justify-center"
              style={{ gridColumn: platform === "darwin" ? "2" : "1" }}
            ></div>
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
                          <div className="relative ml-4">
                            <TreeConnector
                              count={sessions.length}
                              rowHeight={36}
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
                                      repositoryName={getRepositoryName(
                                        repository,
                                      )}
                                      isActive={isSessionActive}
                                      indicatorState={sessionIndicatorState}
                                      activeThreadId={activeThreadId}
                                      isPromptExecuting={isPromptExecuting}
                                      threadLastViewedAt={threadLastViewedAt}
                                      onSelect={onSelectWorktree}
                                      onSelectThread={onSelectThread}
                                      onCreateThread={onCreateThread}
                                      onContextMenu={handleWorktreeContextMenu}
                                      onThreadContextMenu={
                                        handleThreadContextMenu
                                      }
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

          {/* Add Workspace Button */}
          <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onAddRepository}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-sm",
                    "px-3 py-2 text-[10px] font-medium uppercase tracking-wider",
                    "border border-white/[0.06] bg-white/[0.02] text-white/50",
                    "transition-all duration-150",
                    "hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/70",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
                  )}
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  Add workspace
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Add a new workspace</TooltipContent>
            </Tooltip>
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

          {/* Thread / Worktree Context Menu */}
          {itemMenu.isOpen && (
            <div
              ref={itemMenuRef}
              className="fixed z-[100] min-w-[180px] border border-white/[0.06] bg-[var(--color-bg-primary)] p-0 shadow-lg"
              style={{ left: itemMenu.x, top: itemMenu.y }}
            >
              <div className="px-3 py-2 border-b border-white/[0.06]">
                <span className="block truncate text-[12px] text-white/60">
                  {itemMenu.label}
                </span>
              </div>

              {itemMenu.confirming === "archive" ? (
                <div className="px-3 py-2 space-y-1.5">
                  <p className="text-[11px] text-white/50">
                    Archive this {itemMenu.type}?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleItemMenuConfirmAction("archive")}
                      className="flex-1 py-1 text-[11px] text-amber-400 hover:bg-amber-500/10 transition-colors duration-150"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => clearItemMenuConfirmation()}
                      className="flex-1 py-1 text-[11px] text-white/40 hover:bg-white/[0.04] transition-colors duration-150"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : itemMenu.confirming === "delete" ? (
                <div className="px-3 py-2 space-y-1.5">
                  <p className="text-[11px] text-white/50">
                    Delete this {itemMenu.type}? This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleItemMenuConfirmAction("delete")}
                      className="flex-1 py-1 text-[11px] text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => clearItemMenuConfirmation()}
                      className="flex-1 py-1 text-[11px] text-white/40 hover:bg-white/[0.04] transition-colors duration-150"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleItemMenuConfirmAction("archive")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.04] transition-colors duration-150"
                  >
                    <Archive className="size-4" />
                    Archive
                  </button>
                  <div className="my-0.5 border-t border-white/[0.06]" />
                  <button
                    type="button"
                    onClick={() => handleItemMenuConfirmAction("delete")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
                  >
                    <Trash className="size-4" />
                    Delete
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
