import { createEmptyWindowLayoutState } from "@pidesk/shared";
import type {
  FileWindowState,
  NoteWindowState,
  RendererWorkspaceSession,
  ThreadConversationState,
  WorkspaceSessionStoreState,
} from "./workspace-session-store";

const EMPTY_WORKSPACE_LAYOUT = createEmptyWindowLayoutState();

function getSessionByWorktree(
  state: WorkspaceSessionStoreState,
  worktreeId: string | null,
): RendererWorkspaceSession | undefined {
  if (!worktreeId) {
    return undefined;
  }

  return state.sessionsByWorktreeId[worktreeId];
}

export function selectActiveWorkspaceSession(
  state: WorkspaceSessionStoreState,
): RendererWorkspaceSession | undefined {
  return getSessionByWorktree(state, state.activeWorktreeId);
}

export function selectActiveWorkspaceLayout(state: WorkspaceSessionStoreState) {
  return selectActiveWorkspaceSession(state)?.layout ?? EMPTY_WORKSPACE_LAYOUT;
}

export function selectActiveWorkspaceSnapGridSize(
  state: WorkspaceSessionStoreState,
): number {
  return selectActiveWorkspaceLayout(state).snapGridSize;
}

export function selectActiveWorkspaceSidebarCollapsed(
  state: WorkspaceSessionStoreState,
): boolean {
  return selectActiveWorkspaceSession(state)?.sidebar.isCollapsed ?? false;
}

export function selectFileWindowStateByWorktree(
  state: WorkspaceSessionStoreState,
  worktreeId: string | null,
  windowId: string,
): FileWindowState | undefined {
  return getSessionByWorktree(state, worktreeId)?.fileContents.get(windowId);
}

export function selectThreadConversationByWorktree(
  state: WorkspaceSessionStoreState,
  worktreeId: string | null,
  threadId: string,
): ThreadConversationState | undefined {
  return getSessionByWorktree(state, worktreeId)?.threadConversations.get(
    threadId,
  );
}

export function selectNoteWindowStateByWorktree(
  state: WorkspaceSessionStoreState,
  worktreeId: string | null,
  windowId: string,
): NoteWindowState | undefined {
  return getSessionByWorktree(state, worktreeId)?.noteContents.get(windowId);
}
