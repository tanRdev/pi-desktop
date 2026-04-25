import { type WindowStoreState, windowReducer } from "./window-store";
import type { RendererWorkspaceSession } from "./workspace-session-store";

function applyLayout(
  session: RendererWorkspaceSession,
  reducer: (state: WindowStoreState) => WindowStoreState,
): RendererWorkspaceSession {
  const nextState = reducer({
    layout: session.layout,
    snapPreview: null,
  });

  return {
    ...session,
    layout: nextState.layout,
  };
}

export function closeWorkspaceSessionWindow(
  session: RendererWorkspaceSession,
  windowId: string,
): RendererWorkspaceSession {
  const closingWindow = session.layout.windows.find(
    (window) => window.id === windowId,
  );
  const nextSession = applyLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "CLOSE_WINDOW",
      payload: { windowId },
    }),
  );

  if (!closingWindow) {
    return nextSession;
  }

  const remainingWindows = nextSession.layout.windows;
  let fileContents = nextSession.fileContents;
  if (fileContents.has(windowId)) {
    fileContents = new Map(fileContents);
    fileContents.delete(windowId);
  }

  let noteContents = nextSession.noteContents;
  const noteIdForWindow =
    closingWindow.kind === "note" ? closingWindow.noteId : null;
  if (noteContents.has(windowId)) {
    noteContents = new Map(noteContents);
    noteContents.delete(windowId);
  }
  if (noteIdForWindow && noteIdForWindow !== windowId) {
    const otherReferences = remainingWindows.some(
      (window) => window.kind === "note" && window.noteId === noteIdForWindow,
    );
    if (!otherReferences && noteContents.has(noteIdForWindow)) {
      if (noteContents === nextSession.noteContents) {
        noteContents = new Map(noteContents);
      }
      noteContents.delete(noteIdForWindow);
    }
  }

  let threadConversations = nextSession.threadConversations;
  if (closingWindow.kind === "chat") {
    const closingThreadId = closingWindow.threadId;
    const otherChatReferences = remainingWindows.some(
      (window) => window.kind === "chat" && window.threadId === closingThreadId,
    );
    if (!otherChatReferences && threadConversations.has(closingThreadId)) {
      threadConversations = new Map(threadConversations);
      threadConversations.delete(closingThreadId);
    }
  }

  let notes = nextSession.notes;
  if (noteIdForWindow) {
    const otherReferences = remainingWindows.some(
      (window) => window.kind === "note" && window.noteId === noteIdForWindow,
    );
    if (!otherReferences && windowId in notes) {
      notes = { ...notes };
      delete notes[windowId];
    }
  }

  return {
    ...nextSession,
    fileContents,
    noteContents,
    threadConversations,
    notes,
  };
}
