import type { RepositorySnapshot } from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import type * as React from "react";
import {
  getRepositoryName,
  ProjectRow,
  type ThreadContextMenuHandler,
  TreeConnector,
  type WorktreeContextMenuHandler,
  WorktreeRow,
} from "./left-sidebar-workspace-tree";

type IndicatorState = "streaming" | "unread" | "idle";

export interface LeftSidebarWorkspacesPanelProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  isPromptExecuting?: boolean;
  threadLastViewedAt?: Record<string, number>;
  isLoading?: boolean;
  expandedRepositoryIds: Set<string>;
  isCreatingSession: boolean;
  onSelectRepository: (repositoryId: string) => void;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread?: (worktreeId: string) => void;
  onCreateSession: () => void | Promise<void>;
  onRepositoryContextMenu: (
    event: React.MouseEvent,
    repository: RepositorySnapshot,
  ) => void;
  onWorktreeContextMenu?: WorktreeContextMenuHandler;
  onThreadContextMenu?: ThreadContextMenuHandler;
}

function getWorktreeIndicatorState(
  session: RepositorySnapshot["worktrees"][number],
  isActive: boolean,
  isPromptExecuting?: boolean,
  threadLastViewedAt?: Record<string, number>,
): IndicatorState {
  const isSessionWorking =
    session.threads.some((thread) => thread.runtime.status === "streaming") ||
    (isActive && Boolean(isPromptExecuting));

  if (isSessionWorking) {
    return "streaming";
  }

  const hasUnreadThread = session.threads.some(
    (thread) =>
      thread.lastActivityAt !== null &&
      thread.lastActivityAt > (threadLastViewedAt?.[thread.id] ?? 0),
  );

  if (!isActive && hasUnreadThread) {
    return "unread";
  }

  return "idle";
}

export function LeftSidebarWorkspacesPanel({
  repositories,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  isPromptExecuting,
  threadLastViewedAt,
  isLoading,
  expandedRepositoryIds,
  isCreatingSession,
  onSelectRepository,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCreateSession,
  onRepositoryContextMenu,
  onWorktreeContextMenu,
  onThreadContextMenu,
}: LeftSidebarWorkspacesPanelProps) {
  return (
    <div className="py-2">
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
                onSelect={onSelectRepository}
                onContextMenu={onRepositoryContextMenu}
                onCreateSession={onCreateSession}
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
                        const isSessionActive = session.id === activeWorktreeId;

                        return (
                          <WorktreeRow
                            key={session.id}
                            session={session}
                            repositoryName={getRepositoryName(repository)}
                            isActive={isSessionActive}
                            indicatorState={getWorktreeIndicatorState(
                              session,
                              isSessionActive,
                              isPromptExecuting,
                              threadLastViewedAt,
                            )}
                            activeThreadId={activeThreadId}
                            isPromptExecuting={isPromptExecuting}
                            threadLastViewedAt={threadLastViewedAt}
                            onSelect={onSelectWorktree}
                            onSelectThread={onSelectThread}
                            onCreateThread={onCreateThread}
                            onContextMenu={onWorktreeContextMenu}
                            onThreadContextMenu={onThreadContextMenu}
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
  );
}
