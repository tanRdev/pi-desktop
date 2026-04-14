import type { FileContent, WorkspaceWindow } from "@pidesk/shared";
import {
  selectFileWindowStateByWorktree,
  selectNoteWindowStateByWorktree,
} from "./workspace-session-selectors";
import type {
  ThreadConversationState,
  WorkspaceSessionStore,
  WorkspaceSessionStoreState,
} from "./workspace-session-store";

export function syncActiveThreadConversation({
  sessionStore,
  worktreeId,
  threadId,
  conversation,
}: {
  sessionStore: WorkspaceSessionStore;
  worktreeId: string | null;
  threadId: string | null;
  conversation: ThreadConversationState;
}) {
  if (!worktreeId || !threadId) {
    return;
  }

  sessionStore
    .getState()
    .setThreadConversationForWorktree(worktreeId, threadId, conversation);
}

export async function openFileWindowForWorktree({
  sessionStore,
  windowActions,
  windows,
  worktreeId,
  worktreePath,
  filePath,
  readFile,
}: {
  sessionStore: WorkspaceSessionStore;
  windowActions: {
    createWindow: WorkspaceSessionStoreState["createWindow"];
    focusWindow: WorkspaceSessionStoreState["focusWindow"];
  };
  windows: WorkspaceWindow[];
  worktreeId: string | null;
  worktreePath: string | null;
  filePath: string;
  readFile: (filePath: string) => Promise<FileContent>;
}): Promise<string> {
  const existingWindow = windows.find(
    (window): window is Extract<WorkspaceWindow, { kind: "file" }> =>
      window.kind === "file" && window.filePath === filePath,
  );

  if (existingWindow) {
    windowActions.focusWindow(existingWindow.id);
    return existingWindow.id;
  }

  const createdWindow = windowActions.createWindow(
    { kind: "file", filePath },
    worktreePath ?? undefined,
  );

  if (!worktreeId) {
    return createdWindow.id;
  }

  sessionStore
    .getState()
    .setFileContentForWorktree(worktreeId, createdWindow.id, {
      content: null,
      isLoading: true,
      error: null,
    });

  try {
    const result = await readFile(filePath);
    sessionStore
      .getState()
      .setFileContentForWorktree(worktreeId, createdWindow.id, {
        content: result,
        isLoading: false,
        error: null,
      });
  } catch (error) {
    sessionStore
      .getState()
      .setFileContentForWorktree(worktreeId, createdWindow.id, {
        content: null,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load file",
      });
  }

  return createdWindow.id;
}

export function updateFileDraftForWorktree({
  sessionStore,
  worktreeId,
  windowId,
  content,
}: {
  sessionStore: WorkspaceSessionStore;
  worktreeId: string | null;
  windowId: string;
  content: string;
}) {
  if (!worktreeId) {
    return;
  }

  const existing = selectFileWindowStateByWorktree(
    sessionStore.getState(),
    worktreeId,
    windowId,
  );

  if (existing?.content?.type !== "text") {
    return;
  }

  sessionStore.getState().setFileContentForWorktree(worktreeId, windowId, {
    ...existing,
    content: {
      ...existing.content,
      content,
    },
  });
}

export async function saveFileWindowForWorktree({
  sessionStore,
  worktreeId,
  windowId,
  filePath,
  writeFile,
}: {
  sessionStore: WorkspaceSessionStore;
  worktreeId: string | null;
  windowId: string;
  filePath: string;
  writeFile: (filePath: string, content: string) => Promise<void>;
}): Promise<boolean> {
  if (!worktreeId) {
    return false;
  }

  const fileData = selectFileWindowStateByWorktree(
    sessionStore.getState(),
    worktreeId,
    windowId,
  );
  if (!fileData?.content || fileData.content.type !== "text") {
    return false;
  }

  await writeFile(filePath, fileData.content.content);
  return true;
}

export async function saveNoteWindowForWorktree({
  sessionStore,
  worktreeId,
  windowId,
  storagePath,
  writeFile,
}: {
  sessionStore: WorkspaceSessionStore;
  worktreeId: string | null;
  windowId: string;
  storagePath?: string;
  writeFile: (filePath: string, content: string) => Promise<void>;
}): Promise<boolean> {
  if (!worktreeId || !storagePath) {
    return false;
  }

  const noteData = selectNoteWindowStateByWorktree(
    sessionStore.getState(),
    worktreeId,
    windowId,
  );
  if (!noteData) {
    return false;
  }

  await writeFile(storagePath, noteData.content);
  return true;
}

function buildProjectNoteStoragePath(worktreePath: string): string {
  return `${worktreePath.replace(/[\\/]+$/, "")}/.pi/desktop/notes/project.md`;
}

function findExistingProjectNoteWindow(
  windows: WorkspaceWindow[],
  storagePath: string,
): Extract<WorkspaceWindow, { kind: "note" }> | undefined {
  return windows.find(
    (window): window is Extract<WorkspaceWindow, { kind: "note" }> =>
      window.kind === "note" && window.storagePath === storagePath,
  );
}

export async function openProjectNoteWindowForWorktree({
  sessionStore,
  windowActions,
  windows,
  worktreeId,
  worktreePath,
  readFile,
}: {
  sessionStore: WorkspaceSessionStore;
  windowActions: {
    createWindow: WorkspaceSessionStoreState["createWindow"];
    focusWindow: WorkspaceSessionStoreState["focusWindow"];
    updateWindow: WorkspaceSessionStoreState["updateWindow"];
  };
  windows: WorkspaceWindow[];
  worktreeId: string | null;
  worktreePath: string | null;
  readFile: (filePath: string) => Promise<FileContent>;
}): Promise<string> {
  if (!worktreePath) {
    const createdWindow = windowActions.createWindow({ kind: "note" });
    windowActions.updateWindow(createdWindow.id, {
      title: "Project Notes",
      noteId: "project-note",
    });

    if (worktreeId) {
      sessionStore
        .getState()
        .setNoteContentForWorktree(worktreeId, createdWindow.id, "");
    }

    return createdWindow.id;
  }

  const storagePath = buildProjectNoteStoragePath(worktreePath);
  const existingWindow = findExistingProjectNoteWindow(windows, storagePath);
  if (existingWindow) {
    windowActions.updateWindow(existingWindow.id, {
      title: "Project Notes",
      noteId: "project-note",
      storagePath,
      state:
        existingWindow.state === "minimized" ? "normal" : existingWindow.state,
    });
    windowActions.focusWindow(existingWindow.id);
    return existingWindow.id;
  }

  const createdWindow = windowActions.createWindow(
    { kind: "note" },
    worktreePath,
  );
  windowActions.updateWindow(createdWindow.id, {
    title: "Project Notes",
    noteId: "project-note",
    storagePath,
  });

  let content = "";
  try {
    const file = await readFile(storagePath);
    if (file.type === "text") {
      content = file.content;
    }
  } catch {
    content = "";
  }

  if (worktreeId) {
    sessionStore
      .getState()
      .setNoteContentForWorktree(worktreeId, createdWindow.id, content);
  }

  return createdWindow.id;
}
