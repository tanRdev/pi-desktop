import type {
  CanvasWindow,
  FileContent,
  SearchMatch,
  SearchResponse,
} from "@pidesk/shared";
import {
  selectFileWindowStateByWorktree,
  selectNoteWindowStateByWorktree,
  selectSearchUiStateByWorktree,
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
  windows: CanvasWindow[];
  worktreeId: string | null;
  worktreePath: string | null;
  filePath: string;
  readFile: (filePath: string) => Promise<FileContent>;
}): Promise<string> {
  const existingWindow = windows.find(
    (window): window is Extract<CanvasWindow, { kind: "file" }> =>
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

export function initializeSearchWindowForWorktree({
  sessionStore,
  worktreeId,
  windowId,
}: {
  sessionStore: WorkspaceSessionStore;
  worktreeId: string | null;
  windowId: string;
}) {
  if (!worktreeId) {
    return;
  }

  sessionStore.getState().setSearchUiStateForWorktree(worktreeId, windowId, {
    isLoading: false,
    selectedIndex: -1,
  });
}

export async function updateSearchWindowQueryForWorktree({
  sessionStore,
  requestVersions,
  worktreeId,
  worktreePath,
  windowId,
  query,
  searchFiles,
}: {
  sessionStore: WorkspaceSessionStore;
  requestVersions: Map<string, number>;
  worktreeId: string | null;
  worktreePath: string | null;
  windowId: string;
  query: string;
  searchFiles: (args: {
    query: string;
    rootPath: string;
    maxResults: number;
  }) => Promise<SearchResponse>;
}) {
  if (!worktreeId) {
    return;
  }

  sessionStore.getState().updateWindowForWorktree(worktreeId, windowId, {
    query,
    results: [],
  });

  const requestVersion = (requestVersions.get(windowId) ?? 0) + 1;
  requestVersions.set(windowId, requestVersion);
  sessionStore.getState().setSearchUiStateForWorktree(worktreeId, windowId, {
    isLoading: true,
    selectedIndex: -1,
  });

  if (!query.trim() || !worktreePath) {
    sessionStore.getState().setSearchUiStateForWorktree(worktreeId, windowId, {
      isLoading: false,
      selectedIndex: -1,
    });
    return;
  }

  try {
    const response = await searchFiles({
      query,
      rootPath: worktreePath,
      maxResults: 20,
    });

    if (requestVersions.get(windowId) !== requestVersion) {
      return;
    }

    sessionStore.getState().updateWindowForWorktree(worktreeId, windowId, {
      query,
      results: response.results,
    });
    sessionStore.getState().setSearchUiStateForWorktree(worktreeId, windowId, {
      isLoading: false,
      selectedIndex: response.results.length > 0 ? 0 : -1,
    });
  } catch {
    sessionStore.getState().setSearchUiStateForWorktree(worktreeId, windowId, {
      isLoading: false,
      selectedIndex: -1,
    });
  }
}

export function hoverSearchResultForWorktree({
  sessionStore,
  worktreeId,
  windowId,
  index,
}: {
  sessionStore: WorkspaceSessionStore;
  worktreeId: string | null;
  windowId: string;
  index: number;
}) {
  if (!worktreeId) {
    return;
  }

  const uiState = selectSearchUiStateByWorktree(
    sessionStore.getState(),
    worktreeId,
    windowId,
  );
  sessionStore.getState().setSearchUiStateForWorktree(worktreeId, windowId, {
    isLoading: uiState?.isLoading ?? false,
    selectedIndex: index,
  });
}

export function selectSearchResultIndexForWorktree({
  sessionStore,
  worktreeId,
  windowId,
  results,
  direction,
}: {
  sessionStore: WorkspaceSessionStore;
  worktreeId: string | null;
  windowId: string;
  results: SearchMatch[];
  direction: "next" | "previous";
}) {
  if (!worktreeId) {
    return -1;
  }

  const currentIndex =
    selectSearchUiStateByWorktree(sessionStore.getState(), worktreeId, windowId)
      ?.selectedIndex ?? -1;

  if (results.length === 0) {
    sessionStore.getState().setSearchUiStateForWorktree(worktreeId, windowId, {
      isLoading: false,
      selectedIndex: -1,
    });
    return -1;
  }

  const nextIndex =
    direction === "next"
      ? (currentIndex + 1) % results.length
      : (currentIndex - 1 + results.length) % results.length;

  sessionStore.getState().setSearchUiStateForWorktree(worktreeId, windowId, {
    isLoading: false,
    selectedIndex: nextIndex,
  });

  return nextIndex;
}
