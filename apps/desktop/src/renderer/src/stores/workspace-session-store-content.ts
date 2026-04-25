import type {
  AgentMessageSnapshot,
  FileContent,
  WorkspaceNoteState,
} from "@pi-desktop/shared";
import type { RendererWorkspaceSession } from "./workspace-session-store";

export type ThreadConversationState = {
  messages: AgentMessageSnapshot[];
  status: string;
  lastError: string | null;
};

export type FileWindowState = {
  content: FileContent | null;
  isLoading: boolean;
  error: string | null;
};

export type NoteWindowState = {
  content: string;
  error: string | null;
};

type ContentMutationSession = Pick<
  RendererWorkspaceSession,
  "layout" | "notes" | "threadConversations" | "fileContents" | "noteContents"
>;

function resolveNoteId(
  session: Pick<RendererWorkspaceSession, "layout" | "notes">,
  windowId: string,
): string {
  const existingNoteId = session.notes[windowId]?.noteId;
  if (existingNoteId) {
    return existingNoteId;
  }

  const noteWindow = session.layout.windows.find(
    (window) => window.id === windowId && window.kind === "note",
  );

  return (
    (noteWindow?.kind === "note" ? noteWindow.noteId : undefined) ?? windowId
  );
}

export function createThreadConversationUpdate(
  session: ContentMutationSession,
  threadId: string,
  value: ThreadConversationState,
): Pick<RendererWorkspaceSession, "threadConversations"> {
  return {
    threadConversations: new Map(session.threadConversations).set(
      threadId,
      value,
    ),
  };
}

export function createFileContentUpdate(
  session: ContentMutationSession,
  windowId: string,
  value: FileWindowState,
): Pick<RendererWorkspaceSession, "fileContents"> {
  return {
    fileContents: new Map(session.fileContents).set(windowId, value),
  };
}

export function createNoteContentUpdate(
  session: ContentMutationSession,
  windowId: string,
  content: string,
): Pick<RendererWorkspaceSession, "noteContents" | "notes"> {
  const noteId = resolveNoteId(session, windowId);
  const notes: Record<string, WorkspaceNoteState> = {
    ...session.notes,
    [windowId]: {
      noteId,
      draft: content,
    },
  };

  return {
    noteContents: new Map(session.noteContents).set(windowId, {
      content,
      error: null,
    }),
    notes,
  };
}
