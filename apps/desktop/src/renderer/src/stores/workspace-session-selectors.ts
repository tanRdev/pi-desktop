import { createEmptyWindowLayoutState } from "@pi-desktop/shared";
import type {
  FileWindowState,
  NoteWindowState,
  RendererWorkspaceSession,
  ThreadConversationState,
  WorkspaceSessionStoreState,
} from "./workspace-session-store";

const EMPTY_WORKSPACE_LAYOUT = createEmptyWindowLayoutState();

/**
 * Minimal single-slot memoizer used to keep parameterized selectors
 * stable across re-renders when inputs haven't changed. This avoids
 * shipping a runtime dependency just to dedupe identity.
 *
 * The returned selector compares all args by strict equality. If any
 * arg changes the selector re-computes.
 */
function memoizeLast<Args extends readonly unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  let lastArgs: Args | null = null;
  let lastResult: Result;
  return (...args: Args): Result => {
    if (
      lastArgs !== null &&
      lastArgs.length === args.length &&
      lastArgs.every((value, index) => Object.is(value, args[index]))
    ) {
      return lastResult;
    }
    lastArgs = args;
    lastResult = fn(...args);
    return lastResult;
  };
}

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

export const selectFileWindowStateByWorktree = memoizeLast(
  (
    state: WorkspaceSessionStoreState,
    worktreeId: string | null,
    windowId: string,
  ): FileWindowState | undefined =>
    getSessionByWorktree(state, worktreeId)?.fileContents.get(windowId),
);

export const selectThreadConversationByWorktree = memoizeLast(
  (
    state: WorkspaceSessionStoreState,
    worktreeId: string | null,
    threadId: string,
  ): ThreadConversationState | undefined =>
    getSessionByWorktree(state, worktreeId)?.threadConversations.get(threadId),
);

export const selectNoteWindowStateByWorktree = memoizeLast(
  (
    state: WorkspaceSessionStoreState,
    worktreeId: string | null,
    windowId: string,
  ): NoteWindowState | undefined =>
    getSessionByWorktree(state, worktreeId)?.noteContents.get(windowId),
);

// Exposed for tests and ad-hoc reuse within the stores module.
export { memoizeLast };
