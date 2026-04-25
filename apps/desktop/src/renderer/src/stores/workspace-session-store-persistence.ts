import type { WorkspaceSession } from "@pi-desktop/shared";
import type { WindowStoreState } from "./window-store";
import type { RendererWorkspaceSession } from "./workspace-session-store";
import { sanitizeWorkspaceSessionLayout } from "./workspace-session-store-migrations";

export function cloneWorkspaceSession(
  session: WorkspaceSession,
): RendererWorkspaceSession {
  const sanitizedLayout = sanitizeWorkspaceSessionLayout(session.layout);

  return {
    ...session,
    layout: {
      ...sanitizedLayout,
      windows: [...sanitizedLayout.windows],
    },
    sidebar: { ...session.sidebar },
    promptDrafts: { ...session.promptDrafts },
    search: { ...session.search },
    files: { ...session.files },
    notes: { ...session.notes },
    recoveryDrafts: { ...session.recoveryDrafts },
    threadConversations: new Map(),
    fileContents: new Map(),
    noteContents: new Map(
      Object.entries(session.notes).map(([windowId, note]) => [
        windowId,
        { content: note.draft, error: null },
      ]),
    ),
  };
}

export function mergeWorkspaceSession(
  currentSession: RendererWorkspaceSession | undefined,
  incomingSession: WorkspaceSession,
): RendererWorkspaceSession {
  const clonedSession = cloneWorkspaceSession(incomingSession);

  if (!currentSession) {
    return clonedSession;
  }

  return {
    ...clonedSession,
    threadConversations: currentSession.threadConversations,
    fileContents: currentSession.fileContents,
    noteContents: currentSession.noteContents,
  };
}

export function toPersistedWorkspaceSession(
  session: RendererWorkspaceSession,
): WorkspaceSession {
  return {
    worktreeId: session.worktreeId,
    layout: sanitizeWorkspaceSessionLayout(session.layout),
    sidebar: session.sidebar,
    promptDrafts: session.promptDrafts,
    search: session.search,
    files: session.files,
    notes: session.notes,
    recoveryDrafts: session.recoveryDrafts,
  };
}

export function applyWorkspaceSessionLayout<
  Session extends Pick<WorkspaceSession, "layout">,
>(
  session: Session,
  reducer: (state: WindowStoreState) => WindowStoreState,
): Session {
  const nextState = reducer({
    layout: session.layout,
    snapPreview: null,
  });

  return {
    ...session,
    layout: nextState.layout,
  };
}

export function updateWorkspaceSessionRecord(
  sessionsByWorktreeId: Record<string, RendererWorkspaceSession>,
  worktreeId: string,
  updater: (session: RendererWorkspaceSession) => RendererWorkspaceSession,
): Record<string, RendererWorkspaceSession> {
  const currentSession = sessionsByWorktreeId[worktreeId];
  if (!currentSession) {
    return sessionsByWorktreeId;
  }

  return {
    ...sessionsByWorktreeId,
    [worktreeId]: updater(currentSession),
  };
}
