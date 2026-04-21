import * as React from "react";
import type { UiInteractionStore } from "@/stores/ui-interaction-store";
import { syncActiveThreadConversation } from "@/stores/workspace-session-runtime";
import type {
  ThreadConversationState,
  WorkspaceSessionStore,
} from "@/stores/workspace-session-store";

export function shouldPersistThreadConversation(
  conversation: ThreadConversationState,
): boolean {
  return !(
    conversation.status === "starting" &&
    conversation.messages.length === 0 &&
    conversation.lastError === null
  );
}

export function shouldRetryEmptyShellReload(input: {
  repositoryCount: number;
  selection: {
    repositoryId: string | null;
    worktreeId: string | null;
    threadId: string | null;
  };
}): boolean {
  if (input.repositoryCount > 0) {
    return false;
  }

  return (
    input.selection.repositoryId !== null ||
    input.selection.worktreeId !== null ||
    input.selection.threadId !== null
  );
}

export interface UseWorkspaceShellSyncOptions {
  activeThreadId: string | null;
  activeWorktreeId: string | null;
  agent: ThreadConversationState;
  reload: () => Promise<void>;
  repositoryCount: number;
  selection: {
    repositoryId: string | null;
    worktreeId: string | null;
    threadId: string | null;
  };
  sessionStore: WorkspaceSessionStore;
  uiStore: UiInteractionStore;
}

export function useWorkspaceShellSync({
  activeThreadId,
  activeWorktreeId,
  agent,
  reload,
  repositoryCount,
  selection,
  sessionStore,
  uiStore,
}: UseWorkspaceShellSyncOptions): void {
  const prevThreadIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (prevThreadIdRef.current && prevThreadIdRef.current !== activeThreadId) {
      uiStore.getState().markThreadViewed(prevThreadIdRef.current);
    }
    if (activeThreadId) {
      uiStore.getState().markThreadViewed(activeThreadId);
    }
    prevThreadIdRef.current = activeThreadId;
  }, [activeThreadId, uiStore]);

  React.useEffect(() => {
    if (!shouldPersistThreadConversation(agent)) {
      return;
    }

    syncActiveThreadConversation({
      sessionStore,
      worktreeId: activeWorktreeId,
      threadId: activeThreadId,
      conversation: agent,
    });
  }, [activeWorktreeId, activeThreadId, agent, sessionStore]);

  React.useEffect(() => {
    if (!shouldRetryEmptyShellReload({ repositoryCount, selection })) {
      return;
    }

    const timer = window.setTimeout(() => {
      void reload();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [reload, repositoryCount, selection]);
}
