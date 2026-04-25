import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { getTrafficLightInset } from "@/lib/title-bar-layout";
import {
  LeftSidebarAddWorkspaceButton,
  LeftSidebarTabs,
} from "./left-sidebar-chrome";
import {
  LeftSidebarItemMenu,
  LeftSidebarRepositoryMenu,
} from "./left-sidebar-menus";
import {
  getRepositoryName,
  SidebarEdgeToggle,
} from "./left-sidebar-workspace-tree";
import { LeftSidebarWorkspacesPanel } from "./left-sidebar-workspaces-panel";
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

          <LeftSidebarTabs activeTab={activeTab} onSelectTab={setActiveTab} />

          {/* Tab body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "workspaces" ? (
              <LeftSidebarWorkspacesPanel
                repositories={repositories}
                activeRepositoryId={activeRepositoryId}
                activeWorktreeId={activeWorktreeId}
                activeThreadId={activeThreadId}
                isPromptExecuting={isPromptExecuting}
                threadLastViewedAt={threadLastViewedAt}
                isLoading={isLoading}
                expandedRepositoryIds={expandedRepositoryIds}
                isCreatingSession={isCreatingSession}
                onSelectRepository={handleSelectProject}
                onSelectWorktree={onSelectWorktree}
                onSelectThread={onSelectThread}
                onCreateThread={onCreateThread}
                onCreateSession={handleCreateSession}
                onRepositoryContextMenu={handleContextMenu}
                onWorktreeContextMenu={handleWorktreeContextMenu}
                onThreadContextMenu={handleThreadContextMenu}
              />
            ) : activeTab === "git" ? (
              (gitPanel ?? <PlaceholderTab name="git" />)
            ) : (
              (filesPanel ?? <PlaceholderTab name="files" />)
            )}
          </div>

          {/* Add Workspace Button */}
          <LeftSidebarAddWorkspaceButton onAddWorkspace={onAddRepository} />

          <SidebarEdgeToggle
            label="Hide sidebar"
            side="right"
            onClick={handleHideSidebar}
            onResizeDragStart={handleResizeDragStart}
          />

          <LeftSidebarRepositoryMenu
            menu={contextMenu}
            menuRef={contextMenuRef}
            onCopyPath={
              onCopyRepositoryPath
                ? (repositoryId) =>
                    handleMenuAction(() => onCopyRepositoryPath(repositoryId))
                : undefined
            }
            onOpenInFinder={
              onOpenInFinder
                ? (repositoryId) =>
                    handleMenuAction(() => onOpenInFinder(repositoryId))
                : undefined
            }
            onRemoveRepository={
              onRemoveRepository
                ? (repositoryId) =>
                    handleMenuAction(() => onRemoveRepository(repositoryId))
                : undefined
            }
          />

          <LeftSidebarItemMenu
            menu={itemMenu}
            menuRef={itemMenuRef}
            onConfirmAction={handleItemMenuConfirmAction}
            onClearConfirmation={clearItemMenuConfirmation}
          />
        </>
      )}
    </aside>
  );
}

export const LeftSidebar = React.memo(LeftSidebarImpl);
